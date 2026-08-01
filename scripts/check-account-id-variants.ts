import { accountIdVariants, normalizeAccountId } from "../lib/account-id"

if (normalizeAccountId("977-909-8866") !== "9779098866") throw new Error("Google dashed id did not normalize")

const variants = accountIdVariants("9779098866")
if (!variants.includes("977-909-8866")) throw new Error("Google dashed variant missing")
if (!variants.includes("9779098866")) throw new Error("Google compact variant missing")

console.log("Account id variant check passed")
