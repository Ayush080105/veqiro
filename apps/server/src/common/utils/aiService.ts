import axios from "axios";

export const aiService = axios.create({
    baseURL: process.env.AI_SERVICE_URL,
    headers: {
        "X-Internal-Api-Key": `${process.env.INTERNAL_API_KEY}`,
    },
});
