import json, urllib.request, urllib.error

BASE = 'http://localhost:3000/api'

def req(method, path, token=None, data=None):
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(BASE + path, data=body, method=method)
    r.add_header('Content-Type', 'application/json')
    if token:
        r.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def login(u):
    _, d = req('POST', '/auth/login', data={'username': u, 'password': '123456'})
    return d['token']

county = login('county1'); town1 = login('town1'); town2 = login('town2')
town3 = login('town3'); grid1 = login('grid1'); grid3 = login('grid3')
acceptor = login('acceptor1'); farmer2 = login('farmer2'); team = login('team1')
fails = []
def check(name, cond, detail=''):
    print(('PASS' if cond else 'FAIL'), name, detail)
    if not cond: fails.append(name)

def house_by_code(code, token):
    _, d = req('GET', '/houses?q=' + code, token)
    return d['data'][0]

# ---------- B房屋：偷换材料阻断验收 ----------
b = house_by_code('NF-YL-000002', county)
arc_b = req('GET', f"/houses/{b['id']}/archive", county)[1]
plan_b = arc_b['plans'][0]
blocking = [i['type'] for i in arc_b['blockingIssues']]
check('B-偷换材料生成阻断异常', 'MATERIAL_SWAP' in blocking, str(blocking))

# 未解决材料问题前组织验收 -> 拒绝
results = [{'itemId': it['id'], 'itemType': it['type'], 'result': 'PASS'} for it in plan_b['items']]
st, d = req('POST', '/acceptances', acceptor, {'houseId': b['id'], 'itemResults': results})
check('B-阻断异常未办结禁止验收', st == 400, d.get('message', '')[:60])

# 无资质施工队不能被选择（尝试用不存在/失效队伍由乡镇创建后提交）
_, teams = req('GET', '/teams', county)[0], None
_, teamlist = req('GET', '/teams', county)
bad_team = [t for t in teamlist if not t['qualified']][0]
st, d = req('POST', '/construction-plans', farmer2, {
    'houseId': b['id'], 'teamId': bad_team['id'],
    'startDate': '2026-10-10', 'endDate': '2026-11-01',
    'budgetItems': [{'name': '防水卷材', 'spec': 'SBS 4mm', 'qty': 10, 'unit': '㎡', 'unitPrice': 45}]})
check('B-阻断异常时连提交计划也被拦截', st == 400 and '阻断' in d['message'], d.get('message', '')[:60])

# 办结材料问题（要求填写处置结果）
swap = arc_b['issues'][0]
st, d = req('POST', f"/issues/{swap['id']}/status", town2, {'status': 'RESOLVED'})
check('B-办结问题必须填处置结果', st == 400)
st, d = req('POST', f"/issues/{swap['id']}/status", town2,
            {'status': 'RESOLVED', 'resolution': '清退非标卷材，更换为SBS 4mm合格材料并复验'})
check('B-问题可办结', st == 201 or st == 200)

# 补助已批准但未销号 -> 禁止发放
sub_b = arc_b['subsidy']
st, d = req('POST', f"/subsidies/{sub_b['id']}/pay", county)
check('B-未销号禁止发补助', st == 400 and '销号' in d['message'], d.get('message', '')[:60])

# ---------- C房屋：拒绝整改/租户不搬，告知与开工制约 ----------
c = house_by_code('NF-QS-000003', county)
arc_c = req('GET', f"/houses/{c['id']}/archive", county)[1]
st, d = req('POST', '/notices', grid3, {'houseId': c['id'], 'method': '现场告知',
                                        'notifiedTo': ['户主'], 'acknowledged': False})
check('C-暂停使用房屋告知未签收被拒', st == 400 and '签收' in d['message'], d.get('message', '')[:60])
st, d = req('POST', '/construction-plans', farmer2, {
    'houseId': c['id'], 'teamId': [t for t in teamlist if t['qualified']][0]['id'],
    'startDate': '2026-10-10', 'endDate': '2026-11-10',
    'budgetItems': [{'name': '拆除', 'qty': 1, 'unit': '项', 'unitPrice': 1000}]})
check('C-阻断问题+未告知禁止开工', st == 400, d.get('message', '')[:60])

# ---------- A房屋：销号+补助已发，复查通过 ----------
a = house_by_code('NF-XK-000001', county)
arc_a = req('GET', f"/houses/{a['id']}/archive", county)[1]
check('A-状态为已销号', a['status'] == 'CLOSED')
check('A-补助已发放', arc_a['subsidy']['status'] == 'PAID')
check('A-转移人员已准许返回', arc_a['evacuations'][0]['allowReturn'] is True)
# 已发补助不能重复发放
st, d = req('POST', f"/subsidies/{arc_a['subsidy']['id']}/pay", county)
check('A-补助不可重复发放', st == 400)

# ---------- E房屋：验收不通过自动生成阻断异常 ----------
e = house_by_code('NF-XK-000005', county)
arc_e = req('GET', f"/houses/{e['id']}/archive", county)[1]
check('E-验收不通过状态', e['status'] == 'ACCEPTANCE_FAILED')
check('E-验收失败阻断异常', any(i['type'] == 'ACCEPTANCE_FAIL' and i['blocksWorkflow'] for i in arc_e['issues']))
# 未处置前再次验收 -> 拒绝
plan_e = arc_e['plans'][0]
results = [{'itemId': it['id'], 'itemType': it['type'], 'result': 'PASS'} for it in plan_e['items']]
st, d = req('POST', '/acceptances', acceptor, {'houseId': e['id'], 'itemResults': results})
check('E-阻断异常未办结不能重新验收', st == 400 and '阻断' in d['message'], d.get('message', '')[:50])

# ---------- F房屋：复查反弹后重新治理并再次销号 ----------
f = house_by_code('NF-QS-000006', county)
arc_f = req('GET', f"/houses/{f['id']}/archive", county)[1]
check('F-反弹状态', f['status'] == 'REBOUND')
# 办结反弹问题 + 重新复核
reb = [i for i in arc_f['issues'] if i['type'] == 'REBOUND'][0]
req('POST', f"/issues/{reb['id']}/status", town3, {'status': 'RESOLVED', 'resolution': '协调邻户停工，重新加固'})
insp_f = arc_f['inspections'][0]
st, d = req('POST', '/reviews', town3, {
    'inspectionId': insp_f['id'], 'decision': 'RECTIFY', 'deadline': '2026-11-20',
    'items': [
        {'type': 'REINFORCE_WALL', 'description': '新增贯通裂缝墙体加固'},
        {'type': 'SET_WARNING', 'description': '邻户施工期间设置监测警示'},
    ]})
check('F-反弹房屋允许重新复核', st in (200, 201), str(d)[:80])
plan2 = d if st in (200,201) else None
if plan2:
    req('POST', '/notices', grid3, {'houseId': f['id'], 'method': '现场告知',
                                    'notifiedTo': ['户主'], 'acknowledged': True})
    for it in plan2['items']:
        req('POST', f"/rectification-items/{it['id']}/status", town3, {'status': 'DONE'})
    results = [{'itemId': it['id'], 'itemType': it['type'], 'result': 'PASS'} for it in plan2['items']]
    st, d = req('POST', '/acceptances', acceptor, {'houseId': f['id'], 'itemResults': results, 'comment': '复验合格'})
    check('F-重新验收通过', st in (200, 201), str(d)[:80])
    st, d = req('POST', '/closes', county, {'houseId': f['id'], 'confirmedAllItems': True,
                                            'confirmedStopUseLifted': True})
    check('F-允许二次销号', st in (200, 201), str(d)[:80])

# ---------- 角色越权 ----------
st, d = req('POST', '/inspections', farmer2, {
    'township': '云岭乡', 'village': 'x', 'address': 'x', 'ownerName': 'x',
    'buildYear': 2000, 'floors': 1})
check('权限-农户不能登记巡查', st == 403)
st, d = req('POST', '/closes', town1, {'houseId': a['id'], 'confirmedAllItems': True,
                                       'confirmedStopUseLifted': True})
check('权限-乡镇不能销号', st == 403)

# ---------- 无Token ----------
st, d = req('GET', '/houses')
check('权限-未登录被拒', st == 401)

print()
print('FAILED:', fails if fails else 'NONE')
