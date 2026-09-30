export function downloadCsv(filename:string, rows:(string|number|null|undefined)[][]){
 const csv=rows.map(row=>row.map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(";")).join("\n");
 const url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));
 const link=document.createElement("a");link.href=url;link.download=filename;link.click();URL.revokeObjectURL(url);
}
