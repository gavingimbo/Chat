import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
console.log('GEMINI_API_KEY provided:', !!process.env.GEMINI_API_KEY);
const apiKey = process.env.GEMINI_API_KEY || '';
(async () => {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.models) {
            data.models.filter((m: any) => m.name.includes('embed')).forEach((m: any) => console.log(m.name, m.supportedGenerationMethods));
        } else {
            console.log('Error:', data);
        }
    } catch (e) {
        console.error(e);
    }
})();
