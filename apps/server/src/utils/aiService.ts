import axios from "axios";

export const aiService = axios.create({
    baseURL: process.env.AI_SERVICE_URL,
    headers: {
        "Authorization": `Bearer ${process.env.INTERNAL_API_KEY}`,
    },
});

