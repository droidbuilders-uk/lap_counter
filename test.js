const start_str = "2026-08-01T18:31:56";
const start = new Date(start_str + 'Z').getTime();
const now = new Date("2026-08-01T18:31:56Z").getTime();
console.log({start_str, start, now, diff: now - start});
