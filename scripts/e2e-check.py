#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""端到端验证：巡查→复核→方案→告知→封停→安置协商→补助四级校验→施工→偷换材料拦截→验收→复查→销号→反弹重开→看板"""
import json, urllib.request, urllib.error, sys, os

BASE = os.environ.get('API_BASE', 'http://127.0.0.1:3000/api')
PASS, FAIL = 0, 0

def call(method, path, token=None, body=None, expect=200):
    global FAIL
    req = urllib.request.Request(BASE + path, method=method)
    if token: req.add_header('Authorization', 'Bearer ' + token)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, data=data) as r:
            payload = json.loads(r.read().decode())
            code = r.status
    except urllib.error.HTTPError as e:
        payload = json.loads(e.read().decode())
        code = e.code
    ok = (code == expect) or (expect in (200, 201) and code in (200, 201))
    flag = 'PASS' if ok else 'FAIL'
    if ok: globals()['PASS'] += 1
    else: globals()['FAIL'] += 1
    print(f'[{flag}] {method} {path} -> {code}' + ('' if ok else f' (期望 {expect}) {str(payload)[:200]}'))
    return code, payload

def login(u, p):
    _, d = call('POST', '/auth/login', body={'username': u, 'password': p})
    return d['token'], d['user']

def must(cond, msg):
    global PASS, FAIL
    if cond:
        PASS += 1; print(f'[PASS] ASSERT {msg}')
    else:
        FAIL += 1; print(f'[FAIL] ASSERT {msg}')

# ---------- 登录 ----------
t_grid, u_grid = login('grid', 'grid123')
t_tw, u_tw = login('township', 'town123')
t_ct, u_ct = login('county', 'county123')
t_farmer, u_farmer = login('farmer', 'farmer123')
t_crew, u_crew = login('crew', 'crew123')
t_farmer2, _ = login('farmer2', 'farmer123')
t_tw2, _ = login('township2', 'town123')

# 角色越权
call('POST', '/houses', token=t_farmer, body={'township':'x'}, expect=403)

# ---------- 定位种子房屋 ----------
_, lst = call('GET', '/houses', token=t_ct)
h1 = next(h for h in lst['items'] if h['code'] == 'NF-2026-0001')
h2 = next(h for h in lst['items'] if h['code'] == 'NF-2026-0002')
H1, H2 = h1['id'], h2['id']
must(h1['riskLevel'] == 'EVACUATE', f"种子房屋1规则判定=紧急转移（实际 {h1['riskLevel']}）")
must(h2['riskLevel'] == 'FIX', f"种子房屋2规则判定=限期整改（实际 {h2['riskLevel']}）")
# 网格员数据隔离：grid 属青山镇，看不到白云乡 h2
_, glist = call('GET', '/houses', token=t_grid)
must(all(x['township'] == '青山镇' for x in glist['items']), '网格员仅可见本乡镇房屋')
# 农户仅可见本人房屋
_, flist = call('GET', '/houses', token=t_farmer)
must(all(x['ownerUserId'] == u_farmer['id'] for x in flist['items']) and any(x['id']==H1 for x in flist['items']), '农户仅可见名下房屋')

# 网格员新建一栋：严重地基沉降 → 紧急转移
code, nh = call('POST', '/houses', token=t_grid, body={
    'township':'青山镇','village':'和平村','address':'滑坡点旁自建房','ownerName':'测试户',
    'buildYear':1985,'floors':2,'residents':4,'structure':'土木',
    'wallCracks':'MINOR','roofLeak':'NONE','foundationSettlement':'SEVERE'})
must(nh['inspection']['riskLevel']=='EVACUATE', '地基严重沉降→紧急转移规则命中')
must(any(hit['code']=='R-EVAC-01' for hit in nh['inspection']['ruleHits']), '命中规则 R-EVAC-01')

# ---------- 房屋1全流程 ----------
# 1 复核
call('POST', f'/houses/{H1}/review', token=t_tw, body={'action':'确认','confirmedLevel':'EVACUATE','opinion':'现场核查承重墙贯通性裂缝，确认紧急转移'})
# 2 制定方案（含安置项，自动生成4类告知文书）
call('POST', f'/houses/{H1}/plans', token=t_tw, body={
    'itemKeys':['remove_added_floor','reinforce_wall','repair_roof','evict_business','set_warning','resettlement'],
    'deadline':'2026-11-30'})
# 3 销号前置（应不通过）
_, pc0 = call('GET', f'/houses/{H1}/closure-prechecks', token=t_ct)
must(pc0['allPassed'] is False, '未治理时销号核查不通过')
# 4 农户签收全部文书
_, arc = call('GET', f'/houses/{H1}/archive', token=t_farmer)
for n in arc['notifications']:
    if n['signStatus'] == '待签收':
        call('POST', f"/notifications/{n['id']}/sign", token=t_farmer, body={'signStatus':'已签收','signer':'陈大山'})
# 演示拒签留置（重新查无待签，跳过）
# 5 封停确认
call('POST', f'/houses/{H1}/stop-use', token=t_grid, body={'note':'已贴封条'})
# 6 安置：存在租户不搬协商事项时，转移必须被拦截
call('POST', f'/houses/{H1}/resettlements', token=t_tw, body={
    'persons':5,'arrangement':'集中安置点','membersDetail':'户主夫妇、82岁老人、2楼经营户1家3口中含租户2人'})
_, arc = call('GET', f'/houses/{H1}/archive', token=t_tw)
rid = arc['resettlements'][0]['id']
call('POST', f'/houses/{H1}/issues', token=t_grid, body={'type':'TENANT_REFUSE','description':'2楼餐馆租户认为投入大，拒绝搬离'})
call('POST', f'/resettlements/{rid}/transfer', token=t_tw, body={}, expect=400)
# 协商留痕 + 化解后转移
_, arc = call('GET', f'/houses/{H1}/archive', token=t_tw)
issue_tenant = arc['issues'][0]['id']
call('POST', f'/issues/{issue_tenant}/consultations', token=t_tw, body={
    'participants':'村支书、户主陈大山、82岁陈母、2楼经营户刘某、网格员李网格',
    'content':'说明房屋紧急转移级别与法律责任；为经营户协调村口过渡摊位；老人由其女儿接走；3日内搬离'})
call('POST', f'/issues/{issue_tenant}/resolve', token=t_tw, body={'resolution':'经营户同意搬离并搬至过渡摊位，老人投亲靠友，全体人员已转移'})
call('POST', f'/resettlements/{rid}/transfer', token=t_tw, body={'note':'全部5人转移到位'})
# 验收前返回 → 拦截
call('POST', f'/resettlements/{rid}/return', token=t_tw, body={}, expect=400)

# 7 补助：先不核验权属 → 乡镇初审上报被拦截；核验后通过
crews, _ = None, None
_, crewlist = call('GET', '/construction-crews', token=t_farmer)
crew_good = next(c for c in crewlist if c['name']=='安固加固工程队')
crew_black = next(c for c in crewlist if c['blacklisted'])
# 黑名单施工队申请，校验应标红
call('POST', f'/houses/{H1}/subsidies', token=t_farmer, body={
    'difficultyType':'DIBAO','difficultyProof':True,'ownershipProof':True,'crewId':crew_black['id'],
    'budgetItems':[{'name':'承重墙加固','qty':1,'unit':'项','unitPrice':32000}]})
_, arc = call('GET', f'/houses/{H1}/archive', token=t_tw)
app_black = arc['subsidies'][0]['id']
must(any(c['code']=='CREW_BLACKLIST' and not c['passed'] for c in arc['subsidies'][0]['checks']), '黑名单施工队校验拦截')
must(any(c['code']=='BUDGET_CAP' and not c['passed'] for c in arc['subsidies'][0]['checks']), '超低保户补助上限拦截')
# 该申请资格不符 → 乡镇驳回结案（争议/不符情形必须有结论，才能在销号前清零在途申请）
call('POST', f'/subsidies/{app_black}/township-review', token=t_tw, body={'action':'reject','opinion':'黑名单施工队且预算超限，不予补助'})
# 正规申请：安固乙级，满足拆除加层/加固的乙级要求，金额在限额内
call('POST', f'/houses/{H1}/subsidies', token=t_farmer, body={
    'applicantName':'陈大山','difficultyType':'DIBAO','difficultyProof':True,'ownershipProof':True,'crewId':crew_good['id'],
    'budgetItems':[
        {'name':'拆除违建加层','qty':1,'unit':'项','unitPrice':6000},
        {'name':'承重墙加固','qty':1,'unit':'项','unitPrice':16000},
        {'name':'屋面防水修复','qty':40,'unit':'㎡','unitPrice':120}]})
_, arc = call('GET', f'/houses/{H1}/archive', token=t_tw)
app_ok = arc['subsidies'][0]['id']  # 最新在前
# 权属未核验时乡镇初审上报 → 应400
call('POST', f'/subsidies/{app_ok}/township-review', token=t_tw,
     body={'action':'approve','ownershipVerified':False}, expect=400)
# 现场核验权属+困难情况后上报
call('POST', f'/subsidies/{app_ok}/township-review', token=t_tw, body={
    'action':'approve','ownershipVerified':True,'difficultyType':'DIBAO','approvedAmount':26800,'opinion':'权属清晰、低保属实，同意上报'})
call('POST', f'/subsidies/{app_ok}/county-review', token=t_ct, body={'action':'approve','approvedAmount':26000,'opinion':'核定通过'})
# 未核定不得发放（黑名单那件 TOWNSHIP_REVIEW）
call('POST', f'/subsidies/{app_black}/disburse', token=t_ct, expect=400)
# 验收前销号仍应被补助未发放/未复查等拦截
_, pc1 = call('GET', f'/houses/{H1}/closure-prechecks', token=t_ct)
must(not pc1['allPassed'], '整改未完成时销号不通过')

# 8 启动整改，施工队上传材料、标记完成
call('POST', f'/houses/{H1}/start-rectification', token=t_tw)
call('POST', f'/houses/{H1}/construction-logs', token=t_crew, body={
    'stage':'材料进场','description':'钢筋、水泥进场',
    'materials':[{'name':'钢筋','brand':'HRB400','spec':'Φ16','batch':'B2026-09','qty':2,'cert':'JC-001','matchedSpec':True}],
    'photos':['https://example.com/m1.jpg']})
for k in ['remove_added_floor','reinforce_wall','repair_roof','evict_business','set_warning','resettlement']:
    call('POST', f'/houses/{H1}/plan-item-done', token=t_crew, body={'key':k,'done':True})

# 9 偷换材料未处理 → 验收通过被拦截
call('POST', f'/houses/{H1}/issues', token=t_grid, body={'type':'MATERIAL_FRAUD','description':'进场报验为HRB400 Φ16，现场发现使用瘦身钢筋 Φ14'})
call('POST', f'/houses/{H1}/acceptance', token=t_tw, body={
    'items':[{'key':k,'title':k,'passed':True,'note':'合格'} for k in ['remove_added_floor','reinforce_wall','repair_roof','evict_business','set_warning','resettlement']],
    'photos':['https://example.com/a1.jpg']}, expect=400)
# 偷换材料无处置结果不能化解
_, arc = call('GET', f'/houses/{H1}/archive', token=t_tw)
fraud = next(i for i in arc['issues'] if i['type']=='MATERIAL_FRAUD')
call('POST', f"/issues/{fraud['id']}/resolve", token=t_tw, body={'resolution':''}, expect=400)
call('POST', f"/issues/{fraud['id']}/resolve", token=t_tw, body={'resolution':'责令清退瘦身钢筋，更换Φ16合格钢筋，复检报告 JC-009 合格'})

# 10 逐项验收：缺项/缺照片拦截
call('POST', f'/houses/{H1}/acceptance', token=t_tw, body={
    'items':[{'key':'reinforce_wall','title':'加固承重墙','passed':True,'note':''}],
    'photos':['x']}, expect=400)
call('POST', f'/houses/{H1}/acceptance', token=t_tw, body={
    'items':[{'key':k,'title':k,'passed':True,'note':'合格'} for k in ['remove_added_floor','reinforce_wall','repair_roof','evict_business','set_warning','resettlement']],
    'photos':[]}, expect=400)
# 一次不通过 → 返工 → 再通过
call('POST', f'/houses/{H1}/acceptance', token=t_tw, body={
    'items':[{'key':'remove_added_floor','title':'拆除违建加层','passed':True,'note':'合格'},
             {'key':'reinforce_wall','title':'加固承重墙','passed':False,'note':'加固节点不规范'},
             {'key':'repair_roof','title':'修复屋面','passed':True,'note':''},
             {'key':'evict_business','title':'清退经营租户','passed':True,'note':''},
             {'key':'set_warning','title':'设置警示','passed':True,'note':''},
             {'key':'resettlement','title':'安排临时安置','passed':True,'note':''}],
    'photos':['https://example.com/a1.jpg'],'opinion':'加固节点返工'})
_, arc = call('GET', f'/houses/{H1}/archive', token=t_tw)
must(arc['house']['status']=='ACCEPTANCE_FAIL', '验收不通过状态回退')
# 复工 + 补充施工记录 + 复验通过
call('POST', f'/houses/{H1}/start-rectification', token=t_tw)
call('POST', f'/houses/{H1}/construction-logs', token=t_crew, body={
    'stage':'承重墙加固','description':'节点返工完成','materials':[],'photos':['https://example.com/m2.jpg']})
call('POST', f'/houses/{H1}/acceptance', token=t_tw, body={
    'items':[{'key':k,'title':k,'passed':True,'note':'复验合格'} for k in ['remove_added_floor','reinforce_wall','repair_roof','evict_business','set_warning','resettlement']],
    'photos':['https://example.com/a2.jpg'],'opinion':'全部合格'})

# 11 复查（隐患消除，无加层、无裂缝 → WATCH），销号前再发补助
call('POST', f'/houses/{H1}/reinspect', token=t_grid, body={
    'isRecheck':True,'wallCracks':'NONE','roofLeak':'NONE','foundationSettlement':'NONE','isAddedFloor':False,
    'notes':'加层已拆除、墙体加固完成，裂缝封闭无扩展，复查未发现隐患'})
call('POST', f'/subsidies/{app_ok}/disburse', token=t_ct)
# 人员验收合格后返回
_, arc = call('GET', f'/houses/{H1}/archive', token=t_tw)
rid = arc['resettlements'][0]['id']
call('POST', f'/resettlements/{rid}/return', token=t_tw, body={})

# 12 九项核查全部满足 → 县级销号（验收结果等后生成文书需补签收）
_, arc = call('GET', f'/houses/{H1}/archive', token=t_farmer)
for n in arc['notifications']:
    if n['signStatus'] == '待签收' and n['type'] in ('验收结果告知','补助核定决定'):
        call('POST', f"/notifications/{n['id']}/sign", token=t_farmer, body={'signStatus':'已签收','signer':'陈大山'})
_, pc2 = call('GET', f'/houses/{H1}/closure-prechecks', token=t_ct)
for c in pc2['checks']:
    must(c['passed'], f"销号核查项通过：{c['label']}（{c['detail']}）")
must(pc2['allPassed'], '九项销号前置全部满足')
call('POST', f'/houses/{H1}/close', token=t_ct, body={'opinion':'同意销号'})
# 非县级不能销号（已关闭，状态码400，跳过）

# 13 反弹重开
call('POST', f'/houses/{H1}/issues', token=t_grid, body={'type':'REBOUND','description':'复查发现经营户在一楼重新生火经营，承重墙出现新发丝裂缝'})
_, arc = call('GET', f'/houses/{H1}/archive', token=t_ct)
must(arc['house']['status']=='REBOUND', '反弹后档案自动重开')
must(arc['closures'][0]['status']=='反弹重开', '销号记录标记反弹重开，不只是数量销号')

# ---------- 房屋2：非困难家庭补助被拒（补助发给符合条件家庭） ----------
call('POST', f'/houses/{H2}/review', token=t_tw2, body={'action':'确认','confirmedLevel':'FIX'})
call('POST', f'/houses/{H2}/subsidies', token=t_farmer2, body={
    'difficultyType':'NONE','difficultyProof':False,'ownershipProof':True,'crewId':crew_good['id'],
    'budgetItems':[{'name':'屋面防水','qty':1,'unit':'项','unitPrice':8000}]})
_, arc2 = call('GET', f'/houses/{H2}/archive', token=t_tw)
app2 = arc2['subsidies'][0]['id']
must(any(c['code']=='DIFFICULTY_TYPE' and not c['passed'] for c in arc2['subsidies'][0]['checks']), '无困难类型不予补助校验')
call('POST', f'/subsidies/{app2}/township-review', token=t_tw2, body={'action':'reject','opinion':'非困难家庭，不符合补助条件'})

# 农户拒绝整改事项留痕
call('POST', f'/houses/{H2}/issues', token=t_grid, body={'type':'REFUSE_FIX','description':'户主认为漏雨不严重，不愿配合停炊维修'})

# ---------- 看板 ----------
_, ov = call('GET', '/dashboard/overview', token=t_ct)
must(ov['totals']['houses'] >= 3, f"看板房屋总数（{ov['totals']['houses']}）")
must(ov['highRiskControl']['evacuated'] >= 1, '看板展示紧急转移已实际转移')
must(ov['subsidy']['disbursedAmount'] == 26000, f"已发补助金额=26000（实际 {ov['subsidy']['disbursedAmount']}）")
must(ov['subsidy']['rejected'] >= 2, '驳回申请计入看板（含非困难户）')
must(ov['issues']['byType'].get('REBOUND',0) >= 1, '看板按事项类型统计含反弹')
_, twrows = call('GET', '/dashboard/by-township', token=t_ct)
must(len(twrows) == 2 and any(r['township']=='青山镇' for r in twrows), '按乡镇分组治理进度')
_, ovtw = call('GET', '/dashboard/overview', token=t_tw)
must(ovtw['filter']['scope']=='青山镇', '乡镇账号看板自动限定本乡镇')
# 网格员限本乡镇；农户限名下房屋；施工队无权看板
_, ovgrid = call('GET', '/dashboard/overview', token=t_grid)
must(ovgrid['filter']['scope']=='青山镇', '网格员看板限定本乡镇')
_, ovf = call('GET', '/dashboard/overview', token=t_farmer)
must(ovf['totals']['houses']==1, '农户看板仅统计名下房屋')
call('GET', '/dashboard/overview', token=t_crew, expect=403)

# 雨季风险加重 → 重开待巡查
_, arc = call('GET', f'/houses/{H1}/archive', token=t_grid)
call('POST', f'/houses/{H1}/issues', token=t_grid, body={'type':'RAIN_ESCALATION','description':'连续强降雨后山墙渗水加重'})

print(f'\n===== E2E 结果：{PASS} 通过 / {FAIL} 失败 =====')
sys.exit(1 if FAIL else 0)
