# Combined Workspace status and task activity

One Workspace status control now owns cloud/local save status, tool and workflow attention items, running task summaries, and persistent background activity. The separate task button/drawer is removed. Completed counts stay out of the sidebar; a badge appears only for running work or attention items, without double-counting a stalled task.

The existing task registry/storage key and workflow producers remain intact. Activity mounts inside the shared drawer in either load order. Review task opens/focuses the relevant task within the same panel. Cancel/retry/resume are displayed only when a handler actually exists, so interrupted history after reload cannot offer a nonfunctional retry. Dismiss and Clear finished tasks change task history only.

Sync text distinguishes confirmed cloud sync from browser-only saves. Sync failures take priority, and server status transitions emit an event so the control refreshes promptly. The existing conflict resolution and recovery controls remain in place.

Validation: 2,272 customer tests pass, including combined-panel load order, running/idle badges, sync failure/saving/local states, retry/cancel, reload history, and clear-finished behavior. Static production build and syntax checks pass. These checks prove the implemented UI behavior with simulated workspace/task state; real authenticated research and provider calls are not part of this bounded change. Production status requires exact-SHA CI and release-proof.json with verdict PROVEN.
