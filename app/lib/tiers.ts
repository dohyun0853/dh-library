export const TIER_LABELS:Record<number,string>={1:'일반',2:'특별'};
export function canReadTier(memberTier:number,materialTier:number){return memberTier>=materialTier;}
