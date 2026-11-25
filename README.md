# Freemens' Festive Netball Tournament

Live scores for a four-team Christmas netball tournament: Jingle Ballers, Santa's Shooters, Nutcrackers and Reindeer Rebels.

**Open it:** https://cmarchant.github.io/ChristmasNetball/

## What it does

- **Games**: all 12 league games in two rounds, each split into three parts of two games (1A–1C, 2A–2C). Tap a game to enter the score.
- **Table**: the league table worked out for you (P, W, D, L, goals, goal difference, points, form) and who is still in the race for the Grand Final.
- **Head to head**: how each team did against every other team.
- **Finals**: once the league is finished, 1st plays 2nd in the Grand Final and 3rd plays 4th for third place. Level at full time goes to a golden goal.

## Points

| Result | Points |
| --- | --- |
| Win | 5 |
| Draw | 3 |
| Loss, scoring more than half the winner's goals | 1 |
| Any other loss | 0 |

Ties in the table are split by goal difference, then goals scored.

## Sharing scores

Scores are saved in the browser of the phone that enters them. **Share results link** makes a link with every score in it; anyone who opens it sees the same results.

## Files

A plain static site with no build step: `index.html`, `styles.css`, `app.js`. GitHub Pages serves it from the `main` branch.
