export type ProgressSummary={oneAway:number;twoAway:number;winners:number;totalGames:number}
export function summarizeProgress(rows:Array<{missing_count:number;is_winner:boolean}>):ProgressSummary{
  return rows.reduce((acc,row)=>{acc.totalGames++;if(row.missing_count===1)acc.oneAway++;if(row.missing_count===2)acc.twoAway++;if(row.is_winner)acc.winners++;return acc},{oneAway:0,twoAway:0,winners:0,totalGames:0})
}
