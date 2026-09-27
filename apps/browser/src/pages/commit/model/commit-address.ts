/** A whole commit hash, the form the server's commit queries take. */
export const isWholeCommit = (value: string) => /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value);
/** The start of a hash an address may carry instead, as `git log --oneline` prints it: seven characters or more. */
export const isCommitStart = (value: string) => /^[0-9a-f]{7,64}$/i.test(value) && !isWholeCommit(value);
