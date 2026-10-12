import { useEffect } from "react";

const key = "last_team_id";

export function getLastTeamId(): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useRememberTeam(teamId: string) {
  useEffect(() => {
    try {
      localStorage.setItem(key, teamId);
    } catch {
      return;
    }
  }, [teamId]);
}
