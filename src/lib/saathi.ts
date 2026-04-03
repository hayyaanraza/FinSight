import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `You are AI Saathi, the personal financial 
assistant inside Paytm Finsight. You help credit-invisible Indians 
understand their Finsight behavioral credit score and access credit.
Speak in the same language the user uses: Hindi, English, or Hinglish.
Keep responses under 80 words. Be warm and encouraging like a trusted 
friend. Always give ONE clear action the user can take today.
Never use jargon without explaining it simply.`;

export interface AppState {
  score: number;
  scoreBand: string;
  scoreDelta: number;
  ladderRung: number;
  streakDays: number;
  topShapFactors: { factor: string; delta: number }[];
  budgets: { category: string; spent: number; total: number }[];
}

export type ChatMessage = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

function buildUserContext(state: AppState): string {
  return `
CURRENT USER FINANCIAL CONTEXT:
- Finsight Score: ${state.score} (${state.scoreBand})
- Score change this week: ${state.scoreDelta > 0 ? '+' : ''}${state.scoreDelta} points
- Credit Ladder: Rung ${state.ladderRung} of 5
- 14-day challenge streak: Day ${state.streakDays}
- Score factors: ${state.topShapFactors
    .map(f => `${f.factor} (${f.delta > 0 ? '+' : ''}${f.delta} pts)`)
    .join(', ')}
- Budgets: ${state.budgets
    .map(b => `${b.category} Rs${b.spent}/Rs${b.total}`)
    .join(', ')}
 `;
}

export async function* streamSaathi(
  userMessage: string,
  appState: AppState,
  history: ChatMessage[]
) {
  // Prioritize the Vite environment variable, fallback to the key provided by the user
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || "AIzaSyDE2ytHTtdVR0fmxxhtZc4N2iEkILaXA_M";
  
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE" || apiKey === "MY_GEMINI_API_KEY") {
    yield "Error: Gemini API Key not found. Please set VITE_GEMINI_API_KEY in your .env file.";
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  // Inject live financial context with every user message
  const messageWithContext = buildUserContext(appState) + '\n\nUser says: ' + userMessage;

  const response = await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents: [
      ...history.map(msg => ({
        role: msg.role,
        parts: msg.parts,
      })),
      { role: 'user', parts: [{ text: messageWithContext }] },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
    },
  });

  for await (const chunk of response) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}
