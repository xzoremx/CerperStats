let mode = null;

document.getElementById('mono-btn').addEventListener('click',()=>selectMode('mono'));
document.getElementById('multi-btn').addEventListener('click',()=>selectMode('multi'));

function selectMode(selected){
  mode=selected;
  document.getElementById('config-container').style.display='none';
  document.getElementById('data-entry').style.display='block';
  document.getElementById('mode-title').innerText =
    selected==='mono'?'Modo: Un solo analito':'Modo: Varios analitos';
  generarTabla(selected);
}

function generarTabla(tipo){
  const tbody=document.querySelector('#excel tbody');
  tbody.innerHTML='';
  const filas=20, columnas=tipo==='mono'?10:12;

  const placeholders=tipo==='mono'
    ? Array.from({length:10},(_,i)=>`Analista ${i+1}`)
    : ['Analista','Analito 1','Analito 2','Analito 3',
       'Analito 4','Analito 5','Analito 6','Analito 7','Analito 8','Analito 9','Analito 10','Analito 11'];

  const headerRow=document.createElement('tr');
  for(let c=0;c<columnas;c++){
    const td=document.createElement('td');
    td.contentEditable=true;
    td.classList.add('placeholder');
    td.textContent=placeholders[c]||`Col ${c+1}`;
    td.addEventListener('input',()=>togglePlaceholder(td));
    headerRow.appendChild(td);
  }
  tbody.appendChild(headerRow);

  const bloqueAnalistas = 5;
  let analistaActual = 1;

  for(let i=0;i<filas;i++){
    const tr=document.createElement('tr');
    for(let j=0;j<columnas;j++){
      const td=document.createElement('td');
      td.contentEditable=true;
      td.classList.add('placeholder');
      td.addEventListener('input',()=>togglePlaceholder(td));

      if(tipo==='multi' && j===0){
        td.textContent = `Analista ${analistaActual}`;
        td.classList.add('placeholder');
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
    if(tipo==='multi' && (i+1)%bloqueAnalistas===0) analistaActual++;
  }

  activarNavegacion();
  activarPegado();
}

function togglePlaceholder(td){
  if(td.textContent.trim()==='') td.classList.add('placeholder');
  else td.classList.remove('placeholder');
}

function activarNavegacion(){
  const table=document.getElementById('excel');
  table.addEventListener('keydown',function(e){
    const cell=document.activeElement;
    if(cell.tagName!=='TD') return;
    const tr=cell.parentElement;
    const rowIndex=[...table.rows].indexOf(tr);
    const colIndex=[...tr.cells].indexOf(cell);

    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();
      let targetRow=rowIndex;
      let targetCol=colIndex;

      if(e.key==='ArrowUp') targetRow=Math.max(0,rowIndex-1);
      if(e.key==='ArrowDown') targetRow=rowIndex+1;
      if(e.key==='ArrowLeft') targetCol=Math.max(0,colIndex-1);
      if(e.key==='ArrowRight') targetCol=colIndex+1;

      expandIfNeeded(table,targetRow,targetCol);
      const nextRow=table.rows[targetRow];
      const nextCell=nextRow?.cells[targetCol];
      if(nextCell) nextCell.focus();
    }
  });
}

function expandIfNeeded(table,targetRow,targetCol){
  const totalRows=table.rows.length;
  const totalCols=table.rows[0].cells.length;

  if(targetRow>=totalRows){
    const newRow=document.createElement('tr');
    for(let j=0;j<totalCols;j++){
      const td=document.createElement('td');
      td.contentEditable=true;
      td.classList.add('placeholder');
      td.addEventListener('input',()=>togglePlaceholder(td));
      newRow.appendChild(td);
    }
    table.tBodies[0].appendChild(newRow);
  }

  if(targetCol>=totalCols){
    for(let r of table.rows){
      const td=document.createElement('td');
      td.contentEditable=true;
      td.classList.add('placeholder');
      td.addEventListener('input',()=>togglePlaceholder(td));
      r.appendChild(td);
    }
  }
}

// --- PEGAR DESDE EXCEL ---
function activarPegado() {
  document.getElementById('excel').addEventListener('paste', function(e) {
    const active = document.activeElement;
    if (active.tagName !== 'TD') return;

    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const rows = text.trim().split(/\r?\n/).map(r => r.split('\t'));
    const table = document.getElementById('excel');
    const startRow = [...table.rows].indexOf(active.parentElement);
    const startCol = [...active.parentElement.cells].indexOf(active);

    const neededRows = startRow + rows.length;
    const neededCols = startCol + Math.max(...rows.map(r => r.length));

    while (table.rows.length < neededRows) {
      const newRow = document.createElement('tr');
      for (let j = 0; j < table.rows[0].cells.length; j++) {
        const td = document.createElement('td');
        td.contentEditable = true;
        td.classList.add('placeholder');
        td.addEventListener('input', () => togglePlaceholder(td));
        newRow.appendChild(td);
      }
      table.tBodies[0].appendChild(newRow);
    }

    if (neededCols > table.rows[0].cells.length) {
      for (let r of table.rows) {
        for (let c = r.cells.length; c < neededCols; c++) {
          const td = document.createElement('td');
          td.contentEditable = true;
          td.classList.add('placeholder');
          td.addEventListener('input', () => togglePlaceholder(td));
          r.appendChild(td);
        }
      }
    }

    rows.forEach((r, ri) => {
      const tr = table.rows[startRow + ri];
      if (!tr) return;
      r.forEach((c, ci) => {
        const td = tr.cells[startCol + ci];
        if (!td) return;
        td.textContent = c.trim();
        togglePlaceholder(td);
      });
    });
  });
}

// --- Validación y feedback ---
document.getElementById('validate-btn').addEventListener('click',()=>{
  const rows=leerTabla();
  if(mode==='mono') validarMono(rows); else validarMulti(rows);
});

function leerTabla(){
  const data=[];
  document.querySelectorAll('#excel tr').forEach(tr=>{
    const row=[];
    tr.querySelectorAll('td').forEach(td=>row.push(td.textContent.trim()));
    if(row.some(c=>c!=="")) data.push(row);
  });
  return data;
}

function validarMono(rows){
  if(!rows.length) return feedback("No se detectaron datos.","error");
  const headers=rows[0];
  const numericCheck=rows.slice(1).flat().every(v=>!isNaN(parseFloat(v))||v==="");
  if(!numericCheck) return feedback("Hay valores no numéricos.","error");
  feedback(`Modo monoanalito válido (${headers.length} analistas).`,"ok");
  document.getElementById('send-btn').disabled=false;
}

function validarMulti(rows){
  if(!rows.length) return feedback("No se detectaron datos.","error");
  const headers=rows[0];
  if(headers[0].toLowerCase()!=="analista")
    return feedback("La primera columna debe llamarse 'Analista'.","error");
  const numericCheck=rows.slice(1).flatMap(r=>r.slice(1))
        .every(v=>!isNaN(parseFloat(v))||v==="");
  if(!numericCheck) return feedback("Hay celdas no numéricas.","error");
  feedback(`Modo multianalito válido (${headers.length-1} analitos).`,"ok");
  document.getElementById('send-btn').disabled=false;
}

function feedback(msg,type){
  const fb=document.getElementById('feedback');
  fb.innerText=msg;
  fb.style.color=type==="ok"?"#00ff88":"#ff6666";
}
