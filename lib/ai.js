var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import OpenAI from "openai";
import { UTILITY_MODEL } from "@/lib/ai-utility";
let _openai = null;
const openai = new Proxy({}, {
    get: (_t, prop) => {
        if (!_openai)
            _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        return _openai[prop];
    },
});
export function generateAIResponse(messages) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OpenAI API key is not set");
        }
        const response = yield openai.chat.completions.create({
            model: UTILITY_MODEL,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
            temperature: 0.7,
        });
        return ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "(no response)";
    });
}
