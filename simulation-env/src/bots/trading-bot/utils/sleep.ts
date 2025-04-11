export default function sleep(seconds: number) {
    return new Promise(resolve => setTimeout(() => resolve(null), seconds * 1000));
}