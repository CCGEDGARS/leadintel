# Strategy switches: automatic references and strict prerequisites

Owner instruction: Lookalike must be on with even one usable reference company. A blocked profile/signal must stay off and return to unfinished earlier work, rather than remembering a pending On request. Owner confirmed automatic On.

Root cause: reference synchronization retained a historical requestedActive=false even after model publication. ICP switches also saved requestedActive=true before handing off to research, so unavailable profiles appeared checked and could activate later without another action.

Behavior: source-backed published reference models containing at least one company enable the reference lens automatically. Unanalyzed references and empty active wrappers do not count as usable evidence. Website, target market, targeting confirmation and profile approval are checked before profile/signal activation. Model/evidence gates remain required. A blocked toggle is cleared before form edits persist; the app points at the unfinished control and does not launch research or sending automatically. Lookalike switches are automatic while a model exists. Other blocked profiles require another activation after the prerequisite is finished.

Coverage: one reference, historical Off, empty wrapper, reference removal, save/reload, blocked real switch handlers, prior-step navigation, and cross-industry reference fixtures. Old tests requiring pending On and deliberate reference Off were updated to this owner-authorized behavior. No changes to paid-contact permissions, outreach approval or delivery.
