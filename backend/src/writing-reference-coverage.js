// Missing pages are informational once at least 80% of the source is readable.
// Native/vision extraction review is a separate quality gate.
export const WRITING_REFERENCE_READABLE_PERCENT = 80;
export function readableWritingCoverage(coverage={}) {
 const {total,readable,unreadable}=coverage;
 return Number.isInteger(total)&&total>0&&Number.isInteger(readable)&&readable>=0&&readable<=total
  &&Number.isInteger(unreadable)&&unreadable>=0&&readable+unreadable===total
  &&readable*100>=total*WRITING_REFERENCE_READABLE_PERCENT
  &&(!coverage.requiresReview||coverage.reviewAccepted===true);
}
