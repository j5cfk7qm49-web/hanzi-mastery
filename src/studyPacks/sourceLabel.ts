/** Render structured course provenance as readable citations without changing saved content. */
export function sourceLabel(value:string):string {
  try {
    const parsed:unknown=JSON.parse(value);
    const rows=Array.isArray(parsed)?parsed:[parsed];
    if(!rows.length)return value;
    const labels=rows.map(row=>{
      if(!row || typeof row!=='object' || !('file' in row) || typeof row.file!=='string')return undefined;
      const page='page' in row?row.page:undefined;
      if(typeof page==='number' || typeof page==='string')return `${row.file}, ${'page_type' in row && row.page_type==='pdf'?'PDF':'printed'} p. ${page}`;
      if('printed_pages' in row && typeof row.printed_pages==='string')return `${row.file}, printed pp. ${row.printed_pages}`;
      if('pdf_pages' in row && typeof row.pdf_pages==='string')return `${row.file}, PDF pp. ${row.pdf_pages}`;
      return row.file;
    });
    return labels.every(label=>label!==undefined)?labels.join('; '):value;
  }catch{return value;}
}
