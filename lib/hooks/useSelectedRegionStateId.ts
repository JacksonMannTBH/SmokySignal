"use client";

import { useEffect, useState } from "react";
import type { AppStateId } from "../app-regions";
import { stateIdForRegion } from "../regions";
import { REGION_CHANGE_EVENT, getRegion } from "../region-pref";

export function useSelectedRegionStateId(): AppStateId {
  const [stateId, setStateId] = useState<AppStateId>(() =>
    stateIdForRegion(getRegion()),
  );

  useEffect(() => {
    const onRegionChange = () => {
      setStateId(stateIdForRegion(getRegion()));
    };
    window.addEventListener(REGION_CHANGE_EVENT, onRegionChange);
    return () => window.removeEventListener(REGION_CHANGE_EVENT, onRegionChange);
  }, []);

  return stateId;
}
