import { Dispatch, SetStateAction } from "react";

export type TStringOrNullState = [string | null, Dispatch<SetStateAction<string | null>>];
