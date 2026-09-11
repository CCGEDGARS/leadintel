import test from "node:test";
import assert from "node:assert/strict";
import { copilotWorkspaceSaveState } from "../customer/copilot-ui.js";

test("Copilot blocks stale server diagnostics when the workspace has never been saved", () => {
  assert.deepEqual(copilotWorkspaceSaveState({
    isExplicitlySaved: () => false,
    hasUnsavedChanges: () => true
  }), { current: false, reason: "not-saved" });
});

test("Copilot blocks stale server diagnostics when local changes are newer", () => {
  assert.deepEqual(copilotWorkspaceSaveState({
    isExplicitlySaved: () => true,
    hasUnsavedChanges: () => true
  }), { current: false, reason: "unsaved-changes" });
});

test("Copilot may use server diagnostics after the workspace is saved and current", () => {
  assert.deepEqual(copilotWorkspaceSaveState({
    isExplicitlySaved: () => true,
    hasUnsavedChanges: () => false
  }), { current: true, reason: "" });
});
