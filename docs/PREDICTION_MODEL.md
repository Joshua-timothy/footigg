# The prediction model

**Version:** `poisson-dc-1.0.0`

The model answers one question: *what is the probability that both teams score?*
It is a weighted Poisson attack/defence model with a Dixon-Coles low-score correction,
blended in logit space with recent form and head-to-head history. Everything is
deterministic — the same inputs always produce the same output — and every input is
ablated to explain the final number.

There is no machine learning service, no language model and no odds feed. The entire
model is a few hundred lines of pure TypeScript in `src/lib/prediction`.

---

## 1. Inputs

For one fixture, the engine receives:

| Input | Built by | Contents |
| --- | --- | --- |
| `match` | repository | Teams, kickoff, competition, status, score |
| `baseline` | `computeLeagueBaseline` | League home/away goal rates, BTTS rate, sample size |
| `homeRating`, `awayRating` | `fitRatings` | Attack and defence multipliers + reliability |
| `homeForm`, `awayForm` | `buildTeamForm` | Last 10 matches, recency-weighted BTTS rate |
| `h2h` | `computeHeadToHead` | Last 6 meetings and their BTTS rate |

All history is filtered to `kickoff < asOf`. For a stored prediction, `asOf` is the
moment the prediction was generated; for a match-detail view, it is
`min(now, kickoff)`. The model can never see the future.

---

## 2. League baseline

The scoring environment is estimated from finished matches in the same competition,
shrunk toward a long-run prior:

```
avgHomeGoals = (Σ home goals + 1.50 × 28) / (n + 28)
avgAwayGoals = (Σ away goals + 1.20 × 28) / (n + 28)
bttsRate     = (Σ BTTS      + 0.51 × 28) / (n + 28)
```

- Prior: `1.50` home goals, `1.20` away goals, `51%` BTTS, weight `28` matches.
- `priorDominated = n < 28`, which is surfaced as a data-quality note early in a season.
- `n` is the number of finished matches **before** `asOf`.

The prior is intentionally conservative. In August, three matchdays cannot convince the
model that a league has become a 4-goal circus.

---

## 3. Attack and defence ratings

Ratings follow the Maher/Dixon-Coles structure:

```
E[home goals] = avgHomeGoals × attack[home] × defence[away]
E[away goals] = avgAwayGoals × attack[away] × defence[home]
```

Fitting uses **iterative proportional fitting** over every finished match in the
competition window:

1. Initialise every `attack` and `defence` at `1.00`.
2. For each iteration, accumulate weighted observed and expected goals for attack and
   defence, then multiply each rating by `(observed / expected) ^ damping`.
3. Damping is `0.5`, which keeps the loop stable; 40 iterations is ample convergence.
4. Clamp each rating to `[0.20, 5.00]`.
5. Renormalise so the geometric mean of attack is `1.00` (attack and defence are only
   identified up to a shared scale).

Each match observation is weighted by recency:

```
weight = 0.5 ^ (ageInDays / 200)
```

A match from 200 days ago counts half as much as one from today. The half-life is 200
days because a football season is roughly that long; older form is weak evidence about
the current team.

### Shrinkage

Raw ratings from a small sample are noisy, so they are pulled toward `1.00`:

```
reliability = sampleWeight / (sampleWeight + 3.5)
shrunk      = 1 + (raw − 1) × reliability
```

`sampleWeight` is the sum of recency weights, not the raw match count. A newly promoted
side with two games cannot post a 3.4× attack rating; a team with 20 recent matches is
barely affected.

### Expected goals

```
λ_home = clamp(avgHomeGoals × attack[home] × defence[away], 0.15, 4.50)
λ_away = clamp(avgAwayGoals × attack[away] × defence[home], 0.15, 4.50)
```

The clamp prevents a data glitch from producing an absurd matrix. `λ` is reported in the
UI as xG.

---

## 4. Scoreline matrix and Dixon-Coles

For every `(home, away)` pair from `0..8`, the independent Poisson probability is

```
P(h, a) = Poisson(h; λ_home) × Poisson(a; λ_away)
```

Real football produces more `0-0` and `1-1` than independence predicts, and fewer
`1-0` / `0-1`. The Dixon-Coles correction applies a `τ` factor to the four low
scorelines:

| Score | τ |
| --- | --- |
| 0-0 | `1 − λ_home λ_away ρ` |
| 0-1 | `1 + λ_home ρ` |
| 1-0 | `1 + λ_away ρ` |
| 1-1 | `1 − ρ` |
| anything else | `1` |

With `ρ = −0.06`, `0-0` and `1-1` gain probability and `1-0` / `0-1` lose a little.
The grid is renormalised to sum to `1.00` after adjustment.

`P(GG)` is the sum of every cell with both indices ≥ 1. The same grid also produces:

- 1X2, over 1.5 / 2.5 / 3.5, both-teams-to-score, clean-sheet and `0-0` probabilities;
- fair odds (`1 / p`) for YES and NO;
- the top six scorelines by probability.

---

## 5. Blending form and head-to-head

The Poisson probability is the backbone, but two short-horizon signals are blended in
**logit space** so that probabilities stay coherent:

### Form

```
formRate = recency-weighted BTTS rate across each team's last 10 matches
formProb = (homeRate + awayRate)/2 × n/(n+3) + bttsRate × 3/(n+3)
```

where `n = min(homeMatches, awayMatches)` and `bttsRate` is the league baseline. The
`+3` pseudo-matches stop a two-game sample from dominating.

### Head-to-head

```
h2hProb = (bttsMeetings + 3 × bttsRate) / (meetings + 3)
```

Only used when `meetings >= 3`; below that the signal is switched off entirely.

### Weights

```
formWeight = 0.22 × clamp(n / 6, 0, 1)
h2hWeight  = 0.10 × clamp(meetings / 6, 0, 1)   (0 if meetings < 3)
modelWeight = 1 − formWeight − h2hWeight
```

Both signals ramp up with sample size, so a full season gives the configured maximum
(`22%` form, `10%` H2H, `68%` Poisson) and a new season gives almost all the weight to
the ratings.

### Logit blend

```
logOdds = modelWeight × logit(P_poisson)
        + formWeight  × logit(P_form)
        + h2hWeight   × logit(P_h2h)

P(GG) = sigmoid(logOdds / (modelWeight + formWeight + h2hWeight))
```

The result is clamped to `[0.05, 0.95]`. The app never claims certainty, no matter how
lopsided the inputs are.

---

## 6. From probability to verdict

```
pick = P(GG) >= 0.50 ? "YES" : "NO"
distance = |P(GG) − 0.50|

HIGH    if distance >= 0.12 and reliability >= 0.45
MEDIUM  if distance >= 0.06
LOW     otherwise
```

`reliability` combines sample size and rating confidence:

```
reliability = 0.6 × clamp(minFormMatches / 8, 0, 1)
            + 0.4 × min(homeRating.reliability, awayRating.reliability)
```

`confidence` is a separate 0–1 display score:

```
confidence = clamp(0.30 + 0.45 × min(1, distance / 0.30) + 0.20 × reliability, 0.05, 0.97)
```

Conviction is about **edge**; confidence is about **edge plus evidence**. A 62% pick
with 20 matches behind it is HIGH; the same 62% after two games is MEDIUM at best.

---

## 7. Explanations by ablation

Every factor is measured by switching it off and re-running the full model:

| Factor | Ablation |
| --- | --- |
| Home attack | `attack[home] = 1` |
| Away defence | `defence[away] = 1` |
| Away attack | `attack[away] = 1` |
| Home defence | `defence[home] = 1` |
| Home advantage | Use the league's mean goal rate for both sides |
| Recent form | `formWeight = 0` |
| Head-to-head | `h2hWeight = 0` (only shown when the signal is active) |
| Low-score correction | `ρ = 0` |

```
impactPp = (fullProbability − probabilityWithout) × 100
```

Positive means the factor pushes toward YES; negative pushes toward NO. Factors are
sorted by absolute impact. This is why the match page can say *"Brentford defence
0.71× — removing it moves P(GG) by −5.4pp"* without a language model: the number is a
real counterfactual from the same engine.

Ablation impacts do not sum to the final probability — the model is non-linear and the
factors interact. They are directional explanations, not a budget breakdown.

---

## 8. Data quality

| Coverage | Rule |
| --- | --- |
| `HIGH` | `minFormMatches >= 8` and `leagueSample >= 80` |
| `MEDIUM` | `minFormMatches >= 5` |
| `LOW` | anything less |

The match page also lists notes when:

- either team has fewer than 5 recent matches;
- the league sample is prior-dominated (`n < 28`);
- there is no reliable H2H sample;
- one side has no finished matches in the window;
- the fixture is a Champions League match.

---

## 9. Champions League

A CL fixture involves teams from two domestic leagues, so a single-league fit would be
wrong. `PredictionFactory` determines each team's dominant league from its finished-match
count, then fits **one joint model** over:

- the home team's domestic league,
- the away team's domestic league,
- all CL matches in the window.

`filterCompetition` is disabled for this fit, so the baseline and ratings see the whole
pool. The model key is `CL:<homeLeague>:<awayLeague>`, so a Real Madrid vs Bayern tie and
an Arsenal vs PSV tie do not share a cached fit unless they really share both leagues.
The data-quality panel always notes the extra variance of cup football.

---

## 10. Evaluation

Predictions are scored only after the match is `FINISHED` and `btts` is known.

| Metric | Formula | Meaning |
| --- | --- | --- |
| Accuracy | `hits / resolved` | Did the side of 50% match the result? |
| Brier | `(p − outcome)²` | Mean squared probability error; lower is better |
| Log loss | `−(y ln p + (1−y) ln(1−p))` | Punishes confident mistakes; lower is better |
| Calibration | 10 buckets of predicted probability | Does 60% mean 60%? |
| ECE | `Σ (n_b / N) × |observed_b − predicted_b|` | Weighted calibration error |

Reference points: a coin flip scores Brier `0.250` and log loss `0.693`. A model that is
well calibrated but uninformative will sit at those numbers; a model that is informative
but overconfident will beat them on accuracy and lose on log loss.

The demo season is a real backtest: the synthetic fixtures are generated once, the engine
predicts each round using only prior rounds, and the results are scored. The current
demo reports roughly **52% accuracy, Brier ≈ 0.255, log loss ≈ 0.703, ECE ≈ 5.8%** over
333 resolved picks — honest, slightly better than a coin flip on accuracy, and close to
it on proper scoring rules. That is the expected shape for BTTS: it is a high-variance
market and the app does not pretend otherwise.

---

## 11. Parameter table

All values live in `MODEL` in `src/lib/constants.ts`.

| Parameter | Value | Why |
| --- | --- | --- |
| `halfLifeDays` | 200 | One season of relevance |
| `shrinkageMatches` | 3.5 | Strong pull for tiny samples, negligible after ~15 matches |
| `fitIterations` | 40 | Converged IPF |
| `fitDamping` | 0.5 | Stable multiplicative updates |
| `rho` | −0.06 | Standard negative low-score dependence |
| `maxGoals` | 8 | Captures >99.9% of the mass at these λ values |
| `formWeight` | 0.22 | Form matters, but is noisy |
| `h2hWeight` | 0.10 | Small sample, small weight |
| `minH2hMatches` | 3 | Below this, H2H is off |
| `minProbability` / `maxProbability` | 0.05 / 0.95 | No false certainty |
| `historyDays` | 420 | Free-tier window; covers a full season plus buffer |
| `formMatches` | 10 | Enough to see a trend, short enough to be current |
| `h2hMatches` | 6 | Recent meetings only |
| `highConvictionEdge` | 0.12 | ~62% or stronger |
| `mediumConvictionEdge` | 0.06 | ~56% or stronger |
| `minReliableMatches` | 5 | Below this, coverage is LOW |

Baseline priors: `avgHomeGoals 1.50`, `avgAwayGoals 1.20`, `bttsRate 0.51`,
`priorMatches 28`. IPF prior: `1.5` pseudo-goals per rating update.

---

## 12. Limitations

- **BTTS is close to a coin flip.** The achievable edge is small. The model's value is
  transparency and calibration, not a guarantee of profit.
- **No lineups, injuries, weather or motivation.** The free API does not provide them.
  Ratings are form-based and will miss a striker returning from injury.
- **Promoted and relegated teams** start near the league average and need matches to
  separate. The shrinkage is intentional, but it means early-season picks on new teams
  are conservative.
- **Cup and Champions League fixtures** have higher variance than league matches; the
  joint model helps, but it cannot remove the variance.
- **Cross-competition form** is used for the form signal (last 10 matches across
  competitions), while ratings are competition-specific. A team flying in Europe but
  struggling at home will show a mixed signal.
- **No odds comparison.** Fair odds are derived from the model, not from a market; they
  are not a claim about value.
- **The model is not retrained automatically.** Weights and parameters are fixed in
  code. Changing them requires a deploy and a `MODEL.version` bump, which is what keeps
  the historical record honest.
