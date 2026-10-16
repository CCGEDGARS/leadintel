# Startup main-thread stalls: quadratic filename scans

## Evidence

An authenticated new tab at revision 17f6a51e eventually opened, but the opt-in
trace recorded session completion at 52,883 ms, hydration at 55,943 ms and
app state normalization at 72,037 ms. Browser commands timed out while the page
was stalled. This trace alone does not distinguish network time from main-thread
blocking during the session wait.

A synthetic 30 KB punctuation-rich website token reproduced quadratic CPU work
in the real profile normalizer. Node CPU profiling attributed virtually every
sample to the image-filename regex. A regression exercising three such sources
with the Business Identity patch timed out at three seconds before the fix.
The patched regression completes in roughly 100 ms including child-process
startup. Synthetic timing is not a measurement of the customer's Mac.

## Root cause and change

The filename scan began at a word boundary followed by an unbounded non-space
match. Each hyphen in a long scraped identifier allowed another scan of the
remaining suffix. Profile evidence cleanup repeats this operation several times,
and the Business Identity path had the same expression. Asset-noise detection
had another copy.

All three scans now begin only at the start of a whitespace-delimited token.
Matching image assets still disappear from derived prose, while source evidence,
saved records and authentication remain intact. Cache versions are refreshed at
the profile-engine and application entrypoints and the Business Identity import.
No browser-storage reset is part of this fix.

## Verification

- Before/after child-process regression with a strict termination bound.
- Asset cleanup and retained commercial evidence regression.
- Existing Profile Engine and Business Identity suites.
- Full customer suite and exact production/browser acceptance are separate gates;
  do not infer either from the focused test passing.

Lesson: deadline/retry handling cannot rescue a blocked JavaScript main thread.
Exercise realistic long extracted tokens and inspect CPU samples when timers and
browser inspection appear to stop together.
