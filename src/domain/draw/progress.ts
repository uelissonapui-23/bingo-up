export type ProgressSummary={oneAway:number;twoAway:number;winners:number;totalGames:number}
export function summarizeProgress(rows:Array<{missing_count:number;is_winner:boolean}>):ProgressSummary{
  return rows.reduce((acc,row)=>{acc.totalGames++;if(row.missing_count===1)acc.oneAway++;if(row.missing_count===2)acc.twoAway++;if(row.is_winner)acc.winners++;return acc},{oneAway:0,twoAway:0,winners:0,totalGames:0})
}

export type NearWinnerRow={physical_card_id:string;card_game_id:string;position:number;missing_count:number;matched_count:number;card_code?:string|null}
export function prioritizeNearWinners<T extends NearWinnerRow>(rows:T[],limit=8):T[]{
  return rows
    .filter(row=>row.missing_count>0&&row.missing_count<=2)
    .sort((a,b)=>a.missing_count-b.missing_count||b.matched_count-a.matched_count||(a.card_code??'').localeCompare(b.card_code??'')||a.position-b.position)
    .slice(0,Math.max(0,limit))
}
