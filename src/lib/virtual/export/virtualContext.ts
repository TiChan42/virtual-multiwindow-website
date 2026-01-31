import React from "react";
import type { VirtualContext } from "../types";

export const VirtualCtx = React.createContext<VirtualContext | null>(null);