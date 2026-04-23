import { staticFile } from "remotion";
import { loadFont as loadBagel } from "@remotion/google-fonts/BagelFatOne";
import { loadFont as loadArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadSpace } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily: display } = loadBagel();
const { fontFamily: head } = loadArchivo();
const { fontFamily: body } = loadSpace();
const { fontFamily: mono } = loadMono();

export const FONTS = { display, head, body, mono };

export const COLORS = {
  bg: "#EFE7D6",
  ink: "#111111",
  cream: "#FFF9ED",
  red: "#F06464",
  yellow: "#F5C518",
  green: "#1DBC87",
  pink: "#F79FD4",
  violet: "#8A8AF0",
  blue: "#6FCDE8",
} as const;

export const CREW = [
  { name: "VEGA",  role: "Executive Assistant",   color: "#6FCDE8", photo: staticFile("Vega.jpeg")  },
  { name: "SCOUT", role: "Research & Strategist", color: "#F5C518", photo: staticFile("Scout.jpeg") },
  { name: "MAYA",  role: "Content & Marketing",   color: "#F06464", photo: staticFile("Maya.jpeg")  },
  { name: "SAGE",  role: "SEO Specialist",         color: "#F79FD4", photo: staticFile("Sage.jpeg")  },
  { name: "LEX",   role: "Legal Assistant",        color: "#8A8AF0", photo: staticFile("Lex.jpeg")   },
  { name: "REX",   role: "Data Analyst & Finance", color: "#1DBC87", photo: staticFile("Rex.jpeg")   },
] as const;

export type CrewMember = (typeof CREW)[number];
