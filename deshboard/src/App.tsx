import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import type { Dataset, Row } from './types'

function readRowsFromSheet(ws: XLSX.WorkSheet): Row[] {
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header:1, defval:null }) as any[][]
  if (!aoa.length) return []
  const header = (aoa[0] || []).map((h) => (h==null? '' : String(h)))
  const idx = (k: string) => header.indexOf(k)
  const col = {
    y: idx('학년'), c: idx('반'), n: idx('번호'), name: idx('이름'),
    sy: idx('과목학년'), st: idx('과목학기'), group: idx('교과'), subj: idx('과목명'), credit: idx('학점')
  }
  return aoa.slice(1).map((r) => ({
    학년: toNum(r[col.y]), 반: toNum(r[col.c]), 번호: toNum(r[col.n]),
    이름: toStr(r[col.name]), 과목학년: toNum(r[col.sy]), 과목학기: toNum(r[col.st]),
    교과: toStr(r[col.group]), 과목명: toStr(r[col.subj]), 학점: toNum(r[col.credit])
  }))
}

function toNum(v: any): number | null {
  if (v == null) return null
  const s = typeof v === 'string' ? v.trim() : v
  if (s === '') return null
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}
function toStr(v: any): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

// 교과 그룹 정규화: 특정 교과명을 하나의 그룹으로 묶음
function canonGroup(raw: string | null): string {
  if (raw == null) return '기타'
  const s = String(raw).trim()
  if (s === '') return '기타'
  // 기호/폭 정규화
  let normalized = s
    .normalize('NFKC')
    // 다양한 중점 기호를 하나로 통일
    .replace(/[·⋅•∙・ㆍ]/g, '・')
    // 전각 슬래시 통일
    .replace(/／/g, '/')
    // 공백 정리: 구분자 주변 공백 제거
    .replace(/\s*・\s*/g, '・')
    .replace(/\s*\/\s*/g, '/')
    // 괄호 내부 공백 제거: (역사/도덕 포함) -> (역사/도덕포함)
    .replace(/\(([^)]*)\)/g, (_m, inner) => `(${String(inner).replace(/\s+/g, '')})`)

  const target = '기술・가정/제2외국어/한문/교양'
  // 아래 항목들은 모두 하나의 그룹으로 합침
  const cmp = normalized.replace(/\s+/g, '')
  if (
    cmp === target ||
    cmp === '교양' ||
    cmp === '제2외국어' ||
    cmp === '한문' ||
    cmp === '기술・가정' ||
    cmp === '기술・가정/정보'
  ) {
    return target
  }
  return normalized
}

function Upload({ onLoad }: { onLoad: (ds: Dataset) => void }){
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]; if(!f) return
    const buf = await f.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = readRowsFromSheet(ws)
    onLoad({ rows })
  }
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="font-semibold">정리완료.xlsx 업로드</label>
      <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sage-600 file:text-white hover:file:bg-sage-700" />
    </div>
  )
}

function Kpis({ rows }: { rows: Row[] }){
  const total = rows.length
  const students = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows){ if (r.학년!=null && r.반!=null && r.번호!=null) set.add(`${r.학년}-${r.반}-${r.번호}`) }
    return set.size
  }, [rows])
  const creditsByStudent = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows){
      if (r.학년==null || r.반==null || r.번호==null) continue
      const k = `${r.학년}-${r.반}-${r.번호}`
      const prev = m.get(k) || 0
      m.set(k, prev + (r.학점 || 0))
    }
    const vals = Array.from(m.values())
    const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0
    return { count: m.size, avg: Math.round(avg*100)/100 }
  }, [rows])
  return (
    <div className="flex gap-3 mt-3 flex-wrap">
      <Kpi title="총 행 수" value={String(total)} />
      <Kpi title="학생 수" value={String(students)} />
      <Kpi title="학생당 평균 학점" value={String(creditsByStudent.avg)} />
    </div>
  )
}

function Kpi({ title, value }: { title:string, value:string }){
  return (
    <div className="kpi-card min-w-[160px]">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
    </div>
  )
}

function DataTable({ rows }: { rows: Row[] }){
  const cols = ['학년','반','번호','이름','과목학년','과목학기','교과','과목명','학점'] as const
  const first = rows.slice(0, 100)
  return (
    <div className="mt-4 max-h-[480px] overflow-auto border border-sage-200 rounded-xl">
      <table className="w-full border-collapse">
        <thead>
          <tr>{cols.map(c=> <th key={c} className="border-b border-sage-200 p-2 text-left sticky top-0 bg-sage-50">{c}</th>)}</tr>
        </thead>
        <tbody>
          {first.map((r,i)=> (
            <tr key={i} className="odd:bg-white even:bg-sage-50/30">
              {cols.map(c=> <td key={String(c)} className="border-b border-sage-100 p-2">{(r as any)[c] ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-slate-500 p-2">표시: {first.length} / 총 {rows.length}</div>
    </div>
  )
}

function BarRow({ label, value, max }:{ label:string, value:number, max:number }){
  const pct = max>0 ? Math.round((value/max)*100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-sm text-slate-600">{label}</div>
      <div className="flex-1 h-3 bg-sage-100 rounded-full overflow-hidden">
        <div className="h-full bg-sage-500" style={{ width: pct+'%' }} />
      </div>
      <div className="w-12 text-right text-sm">{value}</div>
    </div>
  )
}

export default function App(){
  const [data, setData] = useState<Dataset>({ rows: [] })
  const [selected, setSelected] = useState<string | null>(null)

  const overall = useMemo(() => {
    const all = data.rows
    const totalCredits = all.reduce((s,r)=> s + (r.학점 || 0), 0)
    const bySubject = new Map<string, { credits:number, count:number }>()
    for (const r of all){
      const g = canonGroup(r.교과)
      const ent = bySubject.get(g) || { credits:0, count:0 }
      ent.credits += (r.학점 || 0)
      ent.count += 1
      bySubject.set(g, ent)
    }
    return { totalCredits, bySubject: Array.from(bySubject, ([교과, v]) => ({ 교과, 총학점:v.credits, 건수:v.count })) }
  }, [data])

  const byStudent = useMemo(() => {
    const m = new Map<string, { key:string, 학년:number|null, 반:number|null, 번호:number|null, 이름:string|null, rows: Row[] }>()
    for (const r of data.rows){
      if (r.학년==null || r.반==null || r.번호==null) continue
      const key = `${r.학년}-${r.반}-${r.번호}`
      const prev = m.get(key)
      if (!prev) m.set(key, { key, 학년:r.학년, 반:r.반, 번호:r.번호, 이름:r.이름 ?? null, rows:[r] })
      else prev.rows.push(r)
    }
    const arr = Array.from(m.values()).map(s => {
      const total = s.rows.reduce((sum, r)=> sum + (r.학점 || 0), 0)
      const grp = new Map<string, number>()
      for (const r of s.rows){
        const g = canonGroup(r.교과); grp.set(g, (grp.get(g)||0) + (r.학점 || 0))
      }
      const subjStr = Array.from(grp, ([k,v])=> `${k}:${v}`).join(', ')
      return { ...s, 총학점: total, 교과별합: subjStr }
    })
    arr.sort((a,b)=> (a.학년! - b.학년!) || (a.반! - b.반!) || (a.번호! - b.번호!))
    const detail = (key:string) => {
      const s = m.get(key); if (!s) return { list:[], byGroup:[] }
      const list = s.rows.map(r=> ({ 교과:canonGroup(r.교과), 과목명:r.과목명||'', 학점:r.학점||0, 과목학년:r.과목학년||null, 과목학기:r.과목학기||null }))
      const grp = new Map<string, number>()
      for (const r of list){ grp.set(r.교과, (grp.get(r.교과)||0) + (r.학점 || 0)) }
      const byGroup = Array.from(grp, ([교과, 총학점])=> ({ 교과, 총학점 }))
      return { list, byGroup }
    }
    return { list: arr, detail }
  }, [data])

  // 학급/학생 선택 UI
  const classes = useMemo(() => {
    const set = new Set<string>()
    for (const r of data.rows){ if (r.학년!=null && r.반!=null) set.add(`${r.학년}-${r.반}`) }
    return Array.from(set).sort((a,b)=> {
      const [ag,ac] = a.split('-').map(Number); const [bg,bc] = b.split('-').map(Number)
      return ag-bg || ac-bc
    })
  }, [data])
  const [klass, setKlass] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const studentsInClass = useMemo(() => {
    if (!klass) return [] as { key:string, label:string }[]
    const [g,c] = klass.split('-').map(Number)
    const m = new Map<string, string>()
    for (const r of data.rows){
      if (r.학년===g && r.반===c && r.번호!=null){
        const key = `${g}-${c}-${r.번호}`
        m.set(key, `${String(r.번호).padStart(2,'0')} ${r.이름 ?? ''}`)
      }
    }
    const arr = Array.from(m, ([key,label]) => ({ key, label }))
    arr.sort((a,b)=> a.label.localeCompare(b.label, 'ko'))
    return arr
  }, [data, klass])
  const filteredStudents = studentsInClass.filter(s=> s.label.includes(query))

  const studentDet = selected ? byStudent.detail(selected) : null
  const studentName = useMemo(()=>{
    if (!selected) return ''
    const found = studentsInClass.find(s => s.key===selected)
    return found?.label ?? selected
  }, [studentsInClass, selected])

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-1">과목선택 점검 대시보드</h1>
      <div className="text-slate-600 mb-3">정리완료.xlsx(고정 스키마) 파일을 업로드해 학급/학생별 이수현황을 살펴보세요.</div>
      <div className="card p-4">
        <Upload onLoad={(ds)=> { setData(ds); setKlass(null); setSelected(null); }} />
        {data.rows.length>0 && <Kpis rows={data.rows} />}
      </div>

      {data.rows.length>0 && (
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <div className="md:col-span-1 card p-4">
            <div className="mb-2 font-semibold">학급 선택</div>
            <select className="select mb-3" value={klass ?? ''} onChange={(e)=> { setKlass(e.target.value || null); setSelected(null); }}>
              <option value="">학급을 선택하세요</option>
              {classes.map(k=> <option key={k} value={k}>{k.replace('-', '학년 ') + '반'}</option>)}
            </select>
            {klass && (
              <>
                <div className="mb-1 font-semibold">학생 선택/검색</div>
                <input className="input mb-2" placeholder="이름 또는 번호 검색" value={query} onChange={(e)=> setQuery(e.target.value)} />
                <div className="max-h-64 overflow-auto border border-sage-200 rounded-lg">
                  {filteredStudents.map(s => (
                    <button key={s.key} className={`w-full text-left px-3 py-2 hover:bg-sage-50 ${selected===s.key?'bg-sage-100':''}`} onClick={()=> setSelected(s.key)}>
                      {s.label}
                    </button>
                  ))}
                  {filteredStudents.length===0 && <div className="p-3 text-sm text-slate-500">검색 결과 없음</div>}
                </div>
              </>
            )}
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">전체 요약</div>
                <div className="text-sm text-slate-500">전체 이수학점</div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Kpi title="전체 이수학점" value={String(overall.totalCredits)} />
              </div>
              <div className="mt-3 space-y-2">
                {(() => { const max = Math.max(1, ...overall.bySubject.map(x=> x.총학점)); return overall.bySubject.map(x=> (
                  <BarRow key={x.교과} label={x.교과} value={x.총학점} max={max} />
                ))})()}
              </div>
            </div>

            <div className="card p-4">
              <div className="font-semibold mb-2">학생별 요약</div>
              <div className="text-sm text-slate-500 mb-3">좌측에서 학급과 학생을 선택하세요.</div>
              {selected && studentDet && (
                <div>
                  <div className="mb-2 font-semibold">{klass?.replace('-', '학년 ') + '반'} · {studentName}</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Kpi title="학생 전체 이수학점" value={String(studentDet.list.reduce((s,r)=> s + (r.학점||0), 0))} />
                    <div className="card p-3">
                      <div className="text-sm text-slate-600 mb-2">교과별 이수학점</div>
                      <div className="space-y-2">
                        {(() => { const max = Math.max(1, ...studentDet.byGroup.map(x=> x.총학점)); return studentDet.byGroup.map(x=> (
                          <BarRow key={x.교과} label={x.교과} value={x.총학점} max={max} />
                        ))})()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-semibold mb-2">과목 상세 (교과별)</div>
                    {(() => {
                      const groupMap = new Map<string, typeof studentDet.list>()
                      for (const r of studentDet.list){
                        const g = r.교과;
                        const arr = groupMap.get(g) || [] as typeof studentDet.list;
                        arr.push(r); groupMap.set(g, arr)
                      }
                      const groups = Array.from(groupMap.entries()).sort((a,b)=> a[0].localeCompare(b[0], 'ko'))
                      return (
                        <div className="space-y-4">
                          {groups.map(([g, list]) => (
                            <div key={g} className="card p-3">
                              <div className="font-semibold mb-1">{g}</div>
                              <div className="max-h-60 overflow-auto border border-sage-200 rounded-lg">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr>
                                      <th className="sticky top-0 bg-sage-50 p-2 text-left border-b border-sage-200">과목명</th>
                                      <th className="sticky top-0 bg-sage-50 p-2 text-right border-b border-sage-200">학점</th>
                                      <th className="sticky top-0 bg-sage-50 p-2 text-left border-b border-sage-200">과목학년</th>
                                      <th className="sticky top-0 bg-sage-50 p-2 text-left border-b border-sage-200">과목학기</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {list.map((r,i) => (
                                      <tr key={i} className="odd:bg-white even:bg-sage-50/30">
                                        <td className="p-2 border-b border-sage-100">{r.과목명}</td>
                                        <td className="p-2 border-b border-sage-100 text-right">{r.학점}</td>
                                        <td className="p-2 border-b border-sage-100">{r.과목학년 ?? ''}</td>
                                        <td className="p-2 border-b border-sage-100">{r.과목학기 ?? ''}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
