export { withServer } from '../../../common/testing/http-test-helpers.js';
export async function readSseUntil(response: any, predicate: any) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }
        text += decoder.decode(value, { stream: true });
        if (predicate(text)) {
            await reader.cancel();
            break;
        }
    }
    return text;
}
