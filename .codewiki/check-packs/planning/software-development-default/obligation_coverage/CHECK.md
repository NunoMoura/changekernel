# Planning obligation coverage

## Requirement

The exact Planning Candidate must map every accepted Knowledge target, requirement, dependency, risk, and verification obligation into a bounded Work Graph without orphaned or undeclared work.

## Pass

Pass only when each accepted obligation has exact bounded Work Graph coverage and the graph is executable.

## Fail

Fail when an obligation is missing, duplicated, orphaned, circular, unverifiable, or expanded beyond accepted meaning.

## Feedback

Name exact uncovered obligation and affected Work Unit or dependency. Route meaning defects back to Decision.
