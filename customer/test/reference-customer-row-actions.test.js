const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ui=fs.readFileSync(path.join(__dirname,'..','reference-customer-library-ui.js'),'utf8');
const aiRuntime=fs.readFileSync(path.join(__dirname,'..','reference-customer-ai-runtime.js'),'utf8');

test('every saved customer list exposes Analyze Activate Edit and Delete row actions',()=>{
  assert.match(ui,/data-analyze-reference-list/);
  assert.match(ui,/data-activate-reference-list/);
  assert.match(ui,/data-edit-reference-list/);
  assert.match(ui,/data-delete-reference-list/);
  assert.match(ui,/['"]Analyze['"]/);
  assert.match(ui,/\?\s*'Deactivate'\s*:\s*'Activate'/);
  assert.match(ui,/>Edit<\/button>/);
  assert.match(ui,/>Delete<\/button>/);
});

test('row Analyze selects its list before starting the existing analysis runtime',()=>{
  assert.match(ui,/async function analyzeList\(id/);
  assert.match(ui,/Portfolio\.selectList\(state,id\)/);
  assert.match(ui,/reference-analyze/);
});

test('analysis results are synchronized back into the selected saved list',()=>{
  assert.match(aiRuntime,/LeadIntelReferenceCustomerPortfolio/);
  assert.match(aiRuntime,/Portfolio\.syncCurrentList\(state\)/);
});

test('row activation supports analyzed candidates and active-model deactivation',()=>{
  assert.match(ui,/async function activateList\(id/);
  assert.match(ui,/activateReferenceSegments/);
  assert.match(ui,/publishReferenceModel/);
  assert.match(ui,/setListActive/);
});

test('the current-list editor opens for New List, Edit, or an unsaved draft',()=>{
  assert.match(ui,/let editorOpen=false/);
  assert.match(ui,/const showEditor=Boolean\(editorOpen\|\|draftDirty\|\|!portfolio\.lists\.length\|\|\(saved&&!selected\)\)/);
  assert.match(ui,/showEditor\?`\$\{draftDirty\?/);
  assert.match(ui,/async function editList\(id\)[\s\S]*editorOpen=true/);
  assert.match(ui,/async function createNewList\(\)[\s\S]*editorOpen=true/);
});

test('saving or starting a row action closes the conditional editor',()=>{
  assert.match(ui,/async function saveList\(\)[\s\S]*editorOpen=false/);
  assert.match(ui,/async function analyzeList\(id\)[\s\S]*editorOpen=false/);
  assert.match(ui,/async function activateList\(id\)[\s\S]*editorOpen=false/);
});

test('the conditional editor is rendered beneath the selected saved-list row',()=>{
  assert.match(ui,/function renderSavedLists\(state,editorHtml='',draftDirty=false\)/);
  assert.match(ui,/list\.id===selectedId\?editorHtml:''/);
  assert.match(ui,/renderSavedLists\(state,editorHtml,draftDirty\)/);
});

test('only the selected list has a dark Analyze action and running analysis is explicit',()=>{
  assert.match(ui,/const isSelected=list\.id===selectedId/);
  assert.match(ui,/const isAnalyzing=list\.id===analyzingListId/);
  assert.match(ui,/class="\$\{isSelected\?'primary-btn':'secondary-btn'\}"[^>]*data-analyze-reference-list/);
  assert.match(ui,/\$\{isAnalyzing\?'Analyzing…':'Analyze'\}/);
  assert.match(ui,/\$\{isAnalyzing\?'disabled':''\}/);
});

test('analysis lifecycle marks one list running and clears it when the runtime finishes',()=>{
  assert.match(ui,/let analyzingListId=''/);
  assert.match(ui,/async function analyzeList\(id\)[\s\S]*analyzingListId=id/);
  assert.match(ui,/function finishAnalysis\(\)[\s\S]*analyzingListId=''/);
  assert.match(aiRuntime,/finally\{[\s\S]*finishAnalysis/);
});

test('dark Analyze styling is scoped to the selected saved-list row',()=>{
  assert.doesNotMatch(ui,/\.reference-saved-buttons \[data-analyze-reference-list\]\{background/);
  assert.match(ui,/\.reference-saved-row\.selected \[data-analyze-reference-list\]\{background/);
});


test('unsaved draft editor renders when saved lists already exist',()=>{
  assert.match(ui,/const unselectedEditor=!selectedId\?editorHtml:''/);
  assert.match(ui,/reference-saved-head[\s\S]*\$\{unselectedEditor\}\$\{portfolio\.lists\.map/);
});


test('analyzed lists expose an explicit review state and profile review action',()=>{
  assert.match(ui,/const segments=\(ref\.segments\|\|\[\]\)\.length/);
  assert.match(ui,/const canReview=Boolean\(analyzed&&segments\)/);
  assert.match(ui,/Review buyer context/);
  assert.match(ui,/No shared buyer traits; opportunity search available/);
  assert.match(ui,/data-view-reference-results/);
  assert.match(ui,/>Review profile ↓<\/button>/);
});

test('View Results selects the requested list and scrolls to its segment review',()=>{
  assert.match(ui,/async function viewResults\(id\)/);
  assert.match(ui,/await openList\(id\)/);
  assert.match(ui,/reference-segment-review/);
  assert.match(ui,/scrollIntoView/);
  assert.match(ui,/dataset\.viewReferenceResults/);
});


test('completed enrichment exposes update and copy save modes',()=>{
  assert.match(ui,/Save Updated List/);
  assert.match(ui,/data-save-reference-list-as-new/);
  assert.match(ui,/>Save as New List<\/button>/);
  assert.match(ui,/async function saveAsNewList\(\)/);
  assert.match(ui,/selectedListId=''/);
  assert.match(ui,/function openEditor\(\)/);
});
