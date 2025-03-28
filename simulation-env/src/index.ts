import setupEnvironment from "./setupEnvironment";

export default async function main() {
    await setupEnvironment();
}

(async () => {
    await main();
})();