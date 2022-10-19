const a = [1,22,33,45,12,123,5,756300];
for (const aa of a) {
    try {
        if (aa > 100) {
            throw new Error('Number is greater than 100');
        }
        console.log(aa);
    } catch(e) {

    } finally {
        console.log(`finally: ${aa}`);
    }
}