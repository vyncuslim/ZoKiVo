/* Preview QA preflight: report presence only; never print environment values. */
const expected="qa/vercel-preview-internal-load-20261020";
const check={
 preview:process.env.VERCEL_ENV==="preview",
 branchExact:process.env.VERCEL_GIT_COMMIT_REF===expected,
 databaseConfigured:Boolean(process.env.DATABASE_URL),
 appSessionConfigured:Boolean(process.env.ZOKIVO_SESSION_SECRET),
 neonConfigured:Boolean(process.env.DATABASE_URL&&process.env.DATABASE_URL.startsWith("postgres")),
 runLoad:false
};
console.log("ZOKIVO_QA_PREVIEW_PREFLIGHT="+JSON.stringify(check));
