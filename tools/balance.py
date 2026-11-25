# 밸런스 수치를 엑셀로 내보내고, 고친 엑셀을 게임에 적용한다.
#   python tools/balance.py export   지금 게임에 적용 중인 값으로 balance/balance.xlsx 를 새로 만든다(기존 파일은 .backup.xlsx 로 보관)
#   python tools/balance.py apply    balance/balance.xlsx 를 읽어 기본값과 다른 것만 js/balance.js 에 쓴다
# 기본값은 js/config.js, js/data.js 에 있고, js/balance.js 가 그 위에 덮어쓴다.
import json
import os
import shutil
import subprocess
import sys

from openpyxl import Workbook, load_workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Font, PatternFill

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, 'balance', 'balance.xlsx')
OUT = os.path.join(ROOT, 'js', 'balance.js')

HEAD = PatternFill('solid', fgColor='2F80D0')
KEY = PatternFill('solid', fgColor='E4EFF8')
EDIT = PatternFill('solid', fgColor='FFF7D6')
CHANGED = PatternFill('solid', fgColor='FFC9A8')

# 전체 수치 시트의 설명: 경로의 앞부분(가장 긴 것)이 일치하는 설명을 쓴다. {0},{1}은 남은 칸 이름
DESC = {
    'START_MONEY': ('기본', '시작 자금(원)'),
    'SIM.OPEN': ('영업', '영업 시작 시각(시)'), 'SIM.CLOSE': ('영업', '영업 마감 시각(시)'),
    'SIM.HOUR_W': ('손님 수', '시간대별 유동 가중치(0번=10시)'),
    'SIM.DOW': ('손님 수', '요일별 방문 배수(0=월 … 6=일)'),
    'SIM.WEATHER': ('손님 수', '날씨: [종류, 확률, 방문 배수]'),
    'SIM.BASE_VISITORS': ('손님 수', '하루 기본 방문객(명)'),
    'SIM.REP_MULT': ('손님 수', '평판 0 / 100 일 때 방문 배수'),
    'SIM.SHOW.from': ('공연', '공연 손님이 몰리는 시작 시각'), 'SIM.SHOW.to': ('공연', '공연 손님이 몰리는 끝 시각'),
    'SIM.SHOW.mult': ('공연', '주말 공연: 몰리는 시간대 가중'), 'SIM.SHOW.dayMult': ('공연', '주말 공연: 하루 방문 배수'),
    'SIM.SHOW.first': ('공연', '첫 주말 공연일'),
    'SIM.SHOW.special.first': ('공연', '첫 특별 공연일(토요일이어야 함)'), 'SIM.SHOW.special.every': ('공연', '특별 공연 간격(일)'),
    'SIM.SHOW.special.mult': ('공연', '특별 공연: 몰리는 시간대 가중'), 'SIM.SHOW.special.dayMult': ('공연', '특별 공연: 하루 방문 배수'),
    'SIM.SHOW.special.lead': ('공연', '한정 인형을 며칠 전부터 주문할 수 있는지'),
    'SIM.STRENGTH': ('난이도', '난이도 1~5의 집기 확률 배수(0번=난이도 1)'),
    'SIM.CUSTOMER.BUDGET_AVG': ('손님', '손님 평균 예산(원)'), 'SIM.CUSTOMER.BUDGET_SPREAD': ('손님', '예산 편차'),
    'SIM.CUSTOMER.patience': ('손님', '연속 실패 허용 [최소, 최대]'), 'SIM.CUSTOMER.wait': ('손님', '줄 서서 기다리는 분 [최소, 최대]'),
    'SIM.CUSTOMER.skill': ('손님', '뽑기 숙련 [최소, 최대]'), 'SIM.CUSTOMER.win': ('손님', '성공 후 계속할 확률(0~1)'),
    'SIM.MATCH.appeal': ('취향', '관심 없음 / 즐김 / 가장 좋아함 선호 배수'), 'SIM.MATCH.leave': ('취향', '맞는 인형이 없을 때 돌아갈 확률'),
    'SIM.MATCH.noneMaxPlays': ('취향', '맞는 인형이 없을 때 최대 판 수'), 'SIM.MATCH.satWin': ('취향', '취향 단계 1당, 뽑았을 때 추가 만족'),
    'SIM.MATCH.extraTry': ('취향', '가장 좋아하는 인형이면 계속할 확률 추가'), 'SIM.MATCH.favBudget': ('취향', '가장 좋아하는 인형을 하면 늘어나는 예산 배수'),
    'SIM.CONV_K': ('손님', '클수록 가격·줄 때문에 더 많이 돌아간다'),
    'SIM.RESPOND.bot': ('영업 중 일', '검증용 봇의 대응 시간(분)'), 'SIM.RESPOND.staff': ('영업 중 일', '건너뛴 날 직원의 대응 시간(분)'),
    'SIM.RESPOND.none': ('영업 중 일', '방치(건드리지 않음)'),
    'SIM.TECHNICIAN.delay': ('고장', '이 시간(분)이 지나면 기사를 부른다'), 'SIM.TECHNICIAN.cost': ('고장', '기사 수리비 배수'),
    'SIM.REFILL_AT': ('영업 중 일', '진열이 이 비율 이하면 보충 알림(0~1)'),
    'SIM.LITTER.chance': ('청소', '손님이 쓰레기를 남길 확률'), 'SIM.LITTER.task': ('청소', '쓰레기가 이만큼 쌓이면 청소할 일'),
    'SIM.LITTER.binMult': ('청소', '대형 쓰레기통: 허용량 배수'), 'SIM.LITTER.robotKeep': ('청소', '로봇 청소기: 남는 쓰레기 비율'),
    'SIM.LITTER.sat': ('청소', '더러울 때 만족도 감소'),
    'SIM.EXCHANGE.chance': ('환전', '손님이 환전을 요청할 확률'), 'SIM.EXCHANGE.wait': ('환전', '환전을 기다리는 한계(분)'),
    'SIM.EXCHANGE.exchangerKeep': ('환전', '자동환전기: 남는 요청 비율'),
    'SIM.GLOBALPAY_KPOP': ('설비', '해외결제: K-pop 팬 방문 배수'),
    'SIM.STAFF.rank': ('직원', '고용할 수 있는 단계(3=3랭크)'), 'SIM.STAFF.wage': ('직원', '하루 월급(원)'),
    'SIM.SKIP_NEAR_TOP': ('건너뛰기', '1위 점수의 이 비율부터 건너뛰기 불가'),
    'SIM.START_REP': ('평판', '시작 평판(0~100)'),
    'SIM.DECOR.DUP': ('소품', '같은 소품을 또 놓을 때 효과 배수'), 'SIM.DECOR.CAP': ('소품', '점포 단계별 매력 상한(0=8평 … 3=40평)'),
    'SIM.DECOR.SELL': ('소품', '소품을 팔 때 받는 비율'), 'SIM.STOCK_SELL': ('창고', '인형 처분 가격(원가 비율)'),
    'SIM.FAST_TASK': ('도전과제', '번개 사장: 이 시간(분) 안에 처리'),
    'SIM.BREAK_BASE': ('고장', '기계 하루 고장 확률 기본값'), 'SIM.BREAK_AGE': ('고장', '가동일 하루당 늘어나는 확률'),
    'SIM.BREAK_MAX': ('고장', '고장 확률 상한'), 'SIM.DURABLE_MULT': ('고장', '내구성 개조: 고장 확률 배수'),
    'SIM.CAPACITY_MULT': ('설비', '대용량 개조: 진열 칸 배수'),
    'SIM.BULK': ('발주', '묶음 할인: [수량 이상, 할인율]'),
    'SIM.TREND.days': ('유행', '유행이 바뀌는 주기(일)'), 'SIM.TREND.appeal': ('유행', '유행 인형 선호 배수'),
    'SIM.TREND.price': ('유행', '유행 인형 도매가 배수'), 'SIM.TREND.demand': ('유행', '유행 취향 손님 가중'),
    'SIM.POP.REVENUE': ('인기도', '클수록 인기도가 천천히 오른다(매출 나눔값)'), 'SIM.POP.KEEP': ('인기도', '하루 뒤 남는 인기도 비율'),
    'SIM.POP.PENALTY': ('인기도', '불편 1건당 인기도 감소'),
    'SIM.RANK_POP': ('랭크', '승급 인기도(1=4랭크 … 4=1랭크)'), 'SIM.RANK_REV': ('랭크', '승급 최근 평균 일매출(1=4랭크 … 4=1랭크)'),
    'SIM.NATIONAL.N': ('전국 순위', '라이벌 가게 수'), 'SIM.NATIONAL.TOP': ('전국 순위', '1위 점수'),
    'SIM.NATIONAL.EXP': ('전국 순위', '순위가 내려갈수록 점수가 줄어드는 정도'),
    'SIM.NATIONAL.GROWTH_DAYS': ('전국 순위', '라이벌이 성장하는 기간(일)'), 'SIM.NATIONAL.GROWTH': ('전국 순위', '라이벌 성장 폭'),
}

SIZES = ['S', 'M', 'L', 'XL']


def table_specs(tastes):
    """표 시트: (시트 이름, 데이터 위치, 목록 형태(list/dict), [(열 제목, 필드 경로)])"""
    return [
        ('인형', ['DATA', 'DOLLS'], 'list', [('이름', 'name'), ('크기', 'size'), ('원가(원)', 'cost'), ('취향(1개)', 'taste'), ('집기 어려움 0~1', 'hard'), ('해금 단계 1~5', 'rank'), ('특별 공연 한정', 'special')]),
        ('기계', ['DATA', 'MACHINES'], 'dict', [('이름', 'name'), ('해금 단계', 'rank'), ('구입가', 'price'), ('차지 칸', 'footprint'), ('진열 칸', 'slots'), ('하루 전기', 'power'), ('수리비', 'repair'), ('한 판 시간(초)', 'playSec'),
            ('기본 가격', 'priceDef'), ('가격 최소', 'priceRange.0'), ('가격 최대', 'priceRange.1'), ('기준 가격', 'ref'), ('눈길', 'appeal')]
            + [('집기확률 ' + z, 'grab.' + z) for z in SIZES[:3]] + [('칸 사용 ' + z, 'slotCost.' + z) for z in SIZES]
            + [('어울림 ' + z, 'sizeAppeal.' + z) for z in SIZES] + [('타이머 허용오차 난이도%d' % (i + 1), 'tolerance.%d' % i) for i in range(5)] + [('타이머 손님 오차', 'sigma')]),
        ('손님', ['DATA', 'CUSTOMERS'], 'list', [('분류', 'name'), ('등장 단계', 'rank'), ('방문 비중', 'weight')] + [('취향 ' + t, 'tastes.' + t) for t in tastes]
            + [('몰리는 시작', 'time.hours.0'), ('몰리는 끝', 'time.hours.1'), ('그 시간 배수', 'time.mult'), ('다른 시간 배수', 'time.off'), ('주말 배수', 'time.weekend'), ('공연일 배수', 'time.show')]),
        ('설비', ['DATA', 'EQUIPMENT'], 'dict', [('이름', 'name'), ('해금 단계', 'rank'), ('가격', 'price')]),
        ('소품', ['DATA', 'DECOR'], 'list', [('이름', 'name'), ('해금 단계', 'rank'), ('가격', 'price'), ('차지 칸', 'width'), ('매력(하루 인기도)', 'charm')]),
        ('도전과제', ['DATA', 'ACHIEVEMENTS'], 'list', [('이름', 'name'), ('목표 값', 'goal'), ('상금', 'reward.money')]),
        ('점포', ['CFG', 'SIM', 'SHOP'], 'index', [('이름', 'name'), ('기계 칸', 'slots'), ('필요 단계', 'rank'), ('월 임대료', 'rent'), ('손님 배수', 'foot'), ('확장비', 'cost')]),
        ('창고', ['CFG', 'SIM', 'WAREHOUSE'], 'index', [('보관 수', 'cap'), ('확장비', 'cost'), ('하루 유지비', 'upkeep')]),
    ]


TABLE_PATHS = ('SIM.SHOP.', 'SIM.WAREHOUSE.')


def dump(effective):
    cmd = ['node', os.path.join(ROOT, 'tools', 'balance_dump.js')] + (['--effective'] if effective else [])
    return json.loads(subprocess.check_output(cmd).decode('utf-8'))


def flatten(v, path):
    if isinstance(v, dict):
        for k, x in v.items():
            yield from flatten(x, path + [k])
    elif isinstance(v, list):
        for i, x in enumerate(v):
            yield from flatten(x, path + [i])
    else:
        yield path, v


def scalar_rows(data):
    for path, v in flatten({'START_MONEY': data['CFG']['START_MONEY'], 'SIM': data['CFG']['SIM']}, []):
        key = '.'.join(map(str, path))
        if key.startswith(TABLE_PATHS) or isinstance(v, str):
            continue
        yield key, path, v


def describe(key):
    parts = key.split('.')
    for n in range(len(parts), 0, -1):
        head = '.'.join(parts[:n])
        if head in DESC:
            group, text = DESC[head]
            rest = parts[n:]
            return group, text + (' [' + ']['.join(rest) + ']' if rest else '')
    return '기타', ''


def get(obj, dotted):
    for k in dotted.split('.'):
        if isinstance(obj, list):
            i = int(k)
            if i >= len(obj):
                return None
            obj = obj[i]
        elif isinstance(obj, dict):
            if k not in obj:
                return None
            obj = obj[k]
        else:
            return None
    return obj


def table_items(data, loc, kind):
    node = data
    for k in loc:
        node = node[k]
    if kind == 'dict':
        return list(node.items())
    if kind == 'list':
        return [(x['id'], x) for x in node]
    return [(str(i), x) for i, x in enumerate(node)]


def cell_value(v):
    if isinstance(v, list):
        return ', '.join(map(str, v))
    if isinstance(v, bool):
        return 'O' if v else ''
    return v


def style_header(ws, widths):
    for i, w in enumerate(widths):
        c = ws.cell(row=1, column=i + 1)
        c.fill = HEAD
        c.font = Font(color='FFFFFF', bold=True)
        c.alignment = Alignment(wrap_text=True, vertical='center')
        ws.column_dimensions[c.column_letter].width = w


def export():
    base, now = dump(False), dump(True)
    wb = Workbook()
    ws = wb.active
    ws.title = '안내'
    for line in [
        '인형뽑기 타이쿤 밸런스 표',
        '',
        '1. 노란 칸의 값을 고친다. (파란 줄과 연한 파랑 칸은 이름표이므로 고치지 않는다)',
        '2. 저장하고 엑셀을 닫는다.',
        '3. 프로젝트 폴더의 balance-apply.bat 을 더블클릭한다. 바뀐 항목이 화면에 나온다.',
        '4. 게임(index.html)을 새로고침해 플레이한다. 콘솔로 확인하려면 balance-test.bat.',
        '',
        '- 기본값과 다른 값은 "전체 수치" 시트에서 주황색으로 표시된다.',
        '- 되돌리려면 값을 "기본값" 열과 같게 고치고 다시 적용한다. 전부 되돌리려면 js/balance.js 를 지우고 balance-export.bat 을 실행한다.',
        '- 코드의 값이 바뀐 뒤에는 balance-export.bat 으로 표를 새로 만든다(기존 파일은 balance.backup.xlsx 로 남는다).',
        '- "단계"는 1=5랭크(시작), 2=4랭크, 3=3랭크, 4=2랭크, 5=1랭크.',
        '- 진행 중인 저장의 기계 가격·난이도처럼 플레이어가 정한 값은 바뀌지 않는다.',
    ]:
        ws.append([line])
    ws['A1'].font = Font(size=16, bold=True)
    ws.column_dimensions['A'].width = 110

    ws = wb.create_sheet('전체 수치')
    ws.append(['구분', '설명', '값(수정)', '기본값', '경로(수정 금지)'])
    base_rows = {k: v for k, _, v in scalar_rows(base)}
    for key, _, v in scalar_rows(now):
        group, text = describe(key)
        ws.append([group, text, v, base_rows.get(key), key])
        r = ws.max_row
        ws.cell(r, 3).fill = EDIT
        ws.cell(r, 5).font = Font(color='5F7A92')
    style_header(ws, [12, 52, 16, 16, 34])
    ws.freeze_panes = 'C2'
    ws.auto_filter.ref = ws.dimensions
    ws.conditional_formatting.add('C2:C%d' % ws.max_row, FormulaRule(formula=['C2<>D2'], fill=CHANGED))

    for name, loc, kind, cols in table_specs(now['DATA']['TASTES']):
        ws = wb.create_sheet(name)
        ws.append(['ID(수정 금지)'] + [c[0] for c in cols])
        for key, item in table_items(now, loc, kind):
            ws.append([key] + [cell_value(get(item, f)) for _, f in cols])
            r = ws.max_row
            ws.cell(r, 1).fill = KEY
            for i in range(len(cols)):
                ws.cell(r, i + 2).fill = EDIT
        style_header(ws, [14] + [22 if f in ('name', 'taste') else 13 for _, f in cols])
        ws.row_dimensions[1].height = 32
        ws.freeze_panes = 'C2'

    # 내보낼 때의 코드 기본값을 숨긴 시트에 남긴다: 사용자가 고치지 않은 칸은 나중에 코드 값이 바뀌어도 덮어쓰지 않는다
    ws = wb.create_sheet('_base')
    for path, v in snapshot(base):
        ws.append([path, json.dumps(v, ensure_ascii=False)])
    ws.sheet_state = 'hidden'

    os.makedirs(os.path.dirname(XLSX), exist_ok=True)
    if os.path.exists(XLSX):
        shutil.copy(XLSX, XLSX.replace('.xlsx', '.backup.xlsx'))
    wb.save(XLSX)
    print('만들었습니다:', XLSX)


def snapshot(base):
    """표에 실리는 모든 칸의 (경로 문자열, 코드 기본값)"""
    for _, path, v in scalar_rows(base):
        yield json.dumps(['CFG'] + path), v
    for _, loc, kind, cols in table_specs(base['DATA']['TASTES']):
        for key, item in table_items(base, loc, kind):
            for _, field in cols:
                yield json.dumps(cell_path(loc, kind, key, field)), get(item, field)


def cell_path(loc, kind, key, field):
    return loc + [('#' + key) if kind == 'list' else (int(key) if kind == 'index' else key)] + field.split('.')


def convert(raw, old, field, where, errors):
    """엑셀 칸 값을 기본값의 형태에 맞춰 바꾼다."""
    if field == 'taste':
        return [x.strip() for x in str(raw or '').split(',') if x.strip()]
    if field == 'special':
        return str(raw or '').strip().upper() in ('O', 'TRUE', '1', 'Y')
    if isinstance(old, str):
        return str(raw).strip()
    if isinstance(raw, str):
        try:
            raw = float(raw.replace(',', ''))
        except ValueError:
            errors.append('%s: 숫자가 아닙니다 (%r)' % (where, raw))
            return old
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        errors.append('%s: 숫자가 아닙니다 (%r)' % (where, raw))
        return old
    if raw < 0:
        errors.append('%s: 음수는 쓸 수 없습니다 (%r)' % (where, raw))
        return old
    return int(raw) if float(raw).is_integer() else float(raw)


def apply():
    if not os.path.exists(XLSX):
        sys.exit('엑셀 파일이 없습니다. 먼저 export 를 실행하세요: ' + XLSX)
    base = dump(False)
    wb = load_workbook(XLSX, data_only=True)
    changes, errors = [], []

    ws = wb['전체 수치']
    rows = {k: (p, v) for k, p, v in scalar_rows(base)}
    for r in ws.iter_rows(min_row=2, values_only=True):
        value, key = r[2], r[4]
        if not key:
            continue
        if key not in rows:
            errors.append('전체 수치: 게임에 없는 경로 %s (export 를 다시 하세요)' % key)
            continue
        path, old = rows[key]
        if value is None or value == '':
            errors.append('전체 수치 %s: 값이 비어 있습니다' % key)
            continue
        new = convert(value, old, '', '전체 수치 ' + key, errors)
        if new != old:
            changes.append((['CFG'] + path, new, old, key))

    for name, loc, kind, cols in table_specs(base['DATA']['TASTES']):
        if name not in wb.sheetnames:  # 새로 생긴 표(이전에 만든 엑셀에는 없다)
            continue
        ws = wb[name]
        header = [c.value for c in ws[1]]
        items = dict(table_items(base, loc, kind))
        for r in ws.iter_rows(min_row=2, values_only=True):
            key = None if r[0] is None else str(r[0])
            if key is None:
                continue
            if key not in items:
                errors.append('%s: 게임에 없는 ID %s (새 항목은 data.js 에 추가해야 합니다)' % (name, key))
                continue
            for title, field in cols:
                if title not in header:
                    continue
                raw = r[header.index(title)]
                old = get(items[key], field)
                where = '%s %s [%s]' % (name, key, title)
                if raw is None or raw == '':
                    if field == 'special':
                        if old:
                            new = False
                        else:
                            continue
                    elif old is None:
                        continue
                    else:
                        errors.append(where + ': 값이 비어 있습니다(없애려면 0)')
                        continue
                else:
                    new = convert(raw, old if old is not None else 0, field, where, errors)
                if field == 'special' and old is None and not new:
                    continue
                if field == 'taste':
                    if len(new) != 1:
                        errors.append(where + ': 취향은 하나만 적어 주세요')
                        continue
                    bad = [x for x in new if x not in base['DATA']['TASTES']]
                    if bad:
                        errors.append(where + ': 없는 취향 ' + ', '.join(bad))
                        continue
                if field == 'size' and new not in SIZES:
                    errors.append(where + ': 크기는 S, M, L, XL 중 하나')
                    continue
                if new != old:
                    changes.append((cell_path(loc, kind, key, field), new, old, where))

    if '_base' in wb.sheetnames:  # 내보낼 때의 값 그대로인 칸은 수정이 아니다
        was = {r[0]: json.loads(r[1]) for r in wb['_base'].iter_rows(values_only=True) if r[0]}
        changes = [c for c in changes if not (json.dumps(c[0]) in was and was[json.dumps(c[0])] == c[1])]

    if errors:
        print('적용하지 않았습니다. 아래를 고쳐 주세요:')
        for e in errors:
            print('  -', e)
        sys.exit(1)

    body = ',\n'.join('  ' + json.dumps([p, v], ensure_ascii=False) for p, v, _, _ in changes)
    js = ('// 자동 생성 파일: balance/balance.xlsx → python tools/balance.py apply. 직접 고치지 않는다.\n'
          '// 기본값(config.js, data.js)과 다른 항목만 덮어쓴다. "#id" 는 목록에서 id 로 찾는다.\n'
          '[\n' + body + ('\n' if body else '') + '].forEach(([path, value]) => {\n'
          "  let o = path[0] === 'CFG' ? CFG : DATA;\n"
          '  for (let i = 1; i < path.length; i++) {\n'
          '    let k = path[i];\n'
          "    if (typeof k === 'string' && k[0] === '#') k = o.findIndex((x) => x.id === k.slice(1));\n"
          '    if (i === path.length - 1) o[k] = value;\n'
          '    else o = o[k] || (o[k] = {});\n'
          '  }\n'
          '});\n')
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print('적용했습니다. 기본값과 다른 항목 %d개' % len(changes))
    for _, new, old, label in changes:
        print('  - %s: %s → %s' % (label, old, new))


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'export':
        export()
    elif cmd == 'apply':
        apply()
    else:
        print('사용법: python tools/balance.py export | apply')
