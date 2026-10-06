<template>
  <div v-if="archive">
    <!-- 顶部档案头 -->
    <el-card class="section-card">
      <div class="head">
        <div>
          <div class="h-title">
            <el-tag :type="riskType[h.riskLevel]" size="large">{{ riskLabel[h.riskLevel] }}</el-tag>
            <el-tag :type="statusType[h.status]" size="large" effect="plain">{{ statusLabel[h.status] }}</el-tag>
            <el-tag v-if="h.stopUseConfirmed" type="danger" size="large">已封停停用</el-tag>
            <el-tag v-if="h.status==='CLOSED'" type="success" size="large">已销号</el-tag>
          </div>
          <h2 style="margin:8px 0 4px">{{ h.code }}　{{ h.ownerName }} 家房屋</h2>
          <div style="color:#606266">{{ h.township }} {{ h.village }} {{ h.address }}　居住 {{ h.residents }} 人</div>
        </div>
        <div class="actions">
          <el-button v-if="auth.isGrid" @click="dlg.reinspect=true">巡查/复查登记</el-button>
          <el-button v-if="canReview" type="primary" @click="dlg.review=true">乡镇复核</el-button>
          <el-button v-if="h.status==='REVIEWED' && auth.isTownship" type="primary" @click="openPlan">制定整改方案</el-button>
          <el-button v-if="(h.status==='PLANNED'||h.status==='ACCEPTANCE_FAIL') && auth.isTownship" type="warning" @click="startRect">启动/复工整改</el-button>
          <el-button v-if="isHighRisk && !h.stopUseConfirmed && (auth.isTownship||auth.isGrid)" type="danger" @click="confirmStop">现场封停确认</el-button>
          <el-button v-if="(auth.isTownship||auth.isGrid)" @click="dlg.resettle=true">临时安置安排</el-button>
          <el-button v-if="canAccept && auth.isTownship" type="success" @click="openAcceptance">逐项验收</el-button>
          <el-button v-if="auth.isFarmer" type="primary" @click="openSubsidy">申请施工补助</el-button>
          <el-button v-if="(auth.isCrew||auth.isTownship||auth.isGrid) && h.status==='RECTIFYING'" @click="dlg.log=true">上传施工记录</el-button>
          <el-button @click="dlg.issue=true" type="warning">登记异常/协商事项</el-button>
          <el-button v-if="auth.isCounty" @click="loadPrecheck">销号核查</el-button>
        </div>
      </div>
      <div class="kv" style="margin-top:10px">
        <span><b>建成年份</b>{{ h.buildYear }}</span>
        <span><b>层数</b>{{ h.floors }}</span>
        <span><b>结构</b>{{ h.structure }}</span>
        <span><b>用途</b>{{ h.usage }}<el-tag v-if="h.isBusiness" size="small" type="danger" style="margin-left:4px">经营</el-tag><el-tag v-if="h.isRented" size="small" type="warning" style="margin-left:4px">出租</el-tag></span>
        <span><b>擅自加层</b>{{ h.isAddedFloor ? '是' : '否' }}</span>
        <span><b>墙体裂缝</b><el-tag size="small" :type="sevType[h.wallCracks]">{{ sevLabel[h.wallCracks] }}</el-tag></span>
        <span><b>屋面渗漏</b><el-tag size="small" :type="sevType[h.roofLeak]">{{ sevLabel[h.roofLeak] }}</el-tag></span>
        <span><b>地基沉降</b><el-tag size="small" :type="sevType[h.foundationSettlement]">{{ sevLabel[h.foundationSettlement] }}</el-tag></span>
        <span><b>困难类型</b>{{ diffLabel[h.difficultyType] }}</span>
        <span><b>权属核验</b>{{ h.ownershipVerified ? '已核验' : '未核验' }}</span>
      </div>
    </el-card>

    <el-row :gutter="14">
      <!-- 左列：技术流程 -->
      <el-col :span="14">
        <el-card class="section-card" header="① 巡查记录与风险规则命中">
          <div v-for="i in archive.inspections" :key="i.id" class="timeline-block">
            <h4>
              {{ i.isRecheck ? '【复查】' : '【巡查】' }}{{ fmt(i.inspectedAt) }}　{{ i.inspectorName }}
              <el-tag size="small" :type="riskType[i.riskLevel]" style="margin-left:8px">{{ riskLabel[i.riskLevel] }}</el-tag>
            </h4>
            <el-alert v-for="hit in i.ruleHits" :key="hit.code" :type="hit.level==='EVACUATE'?'error':hit.level==='STOP'?'warning':hit.level==='FIX'?'':'info'"
              :title="`${hit.code}｜${hit.message}`" :closable="false" style="margin:4px 0" />
            <div v-if="i.notes" style="color:#606266;font-size:13px">备注：{{ i.notes }}</div>
          </div>
        </el-card>

        <el-card class="section-card" header="② 乡镇复核">
          <el-empty v-if="!archive.reviews.length" description="尚未复核" :image-size="50" />
          <div v-for="r in archive.reviews" :key="r.id" class="timeline-block">
            <h4>{{ fmt(r.createdAt) }}　{{ r.reviewerName }}　动作：{{ r.action }}
              <el-tag size="small" :type="riskType[r.confirmedLevel]" style="margin-left:8px">确认等级：{{ riskLabel[r.confirmedLevel] }}</el-tag>
            </h4>
            <div v-if="r.opinion">{{ r.opinion }}</div>
          </div>
        </el-card>

        <el-card class="section-card" header="③ 整改方案">
          <el-empty v-if="!archive.plans.length" description="尚未制定方案" :image-size="50" />
          <div v-for="p in archive.plans" :key="p.id" class="timeline-block">
            <h4>{{ fmt(p.createdAt) }}　{{ p.createdByName }} 制定　整改期限：{{ p.deadline }}</h4>
            <el-table :data="p.items" size="small" :show-header="true">
              <el-table-column prop="title" label="整改项" />
              <el-table-column label="所需资质" width="110">
                <template #default="{ row }">{{ row.requiredCrewLevel || '—' }}</template>
              </el-table-column>
              <el-table-column label="施工状态" width="180">
                <template #default="{ row }">
                  <el-tag v-if="row.done" size="small" type="success">施工完成</el-tag>
                  <template v-else>
                    <el-tag size="small" type="info">未完成</el-tag>
                    <el-button v-if="(auth.isCrew||auth.isTownship) && h.status==='RECTIFYING'" link type="primary" size="small" @click="markDone(row.key, true)">标记完成</el-button>
                  </template>
                </template>
              </el-table-column>
            </el-table>
            <div style="margin-top:6px;font-size:13px">
              <el-tag v-if="p.stopUseRequired" type="danger" size="small">须暂停使用</el-tag>
              <el-tag v-if="p.resettlementRequired" type="danger" size="small">须临时安置</el-tag>
              <span v-if="p.remark" style="color:#606266;margin-left:8px">{{ p.remark }}</span>
            </div>
          </div>
        </el-card>

        <el-card class="section-card" header="⑥ 临时安置与人员转移">
          <el-empty v-if="!archive.resettlements.length" description="暂无安置安排" :image-size="50" />
          <div v-for="r in archive.resettlements" :key="r.id" class="timeline-block">
            <h4>{{ r.arrangement }}　{{ r.persons }} 人　<el-tag size="small" :type="r.status==='已转移'?'success':r.status==='已返回'?'info':'warning'">{{ r.status }}</el-tag></h4>
            <div v-if="r.membersDetail" style="font-size:13px;color:#606266">人员构成：{{ r.membersDetail }}</div>
            <div v-if="r.transferredAt" style="font-size:12px">转移时间：{{ fmt(r.transferredAt) }}</div>
            <div v-if="r.returnedAt" style="font-size:12px">返回时间：{{ fmt(r.returnedAt) }}</div>
            <el-button v-if="r.status==='拟安置' && (auth.isTownship||auth.isGrid)" size="small" type="success" @click="transferDone(r.id)">确认人员已实际转移</el-button>
            <el-button v-if="r.status==='已转移' && (auth.isTownship||auth.isGrid)" size="small" @click="returnHome(r.id)">验收合格后确认返回</el-button>
          </div>
        </el-card>

        <el-card class="section-card" header="⑦ 施工过程（材料 / 照片 / 阶段进度）">
          <el-empty v-if="!archive.constructionLogs.length" description="暂无施工记录" :image-size="50" />
          <div v-for="l in archive.constructionLogs" :key="l.id" class="timeline-block">
            <h4>{{ fmt(l.createdAt) }}　{{ l.stage }}　{{ l.createdByName }}</h4>
            <div style="font-size:13px">{{ l.description }}</div>
            <el-table v-if="l.materials.length" :data="l.materials" size="small" style="margin-top:6px">
              <el-table-column prop="name" label="材料" width="110" />
              <el-table-column prop="brand" label="品牌" width="110" />
              <el-table-column prop="spec" label="规格" width="120" />
              <el-table-column prop="batch" label="批次" width="100" />
              <el-table-column prop="qty" label="数量" width="70" />
              <el-table-column prop="cert" label="合格证明" />
              <el-table-column label="比对" width="80">
                <template #default="{ row }"><el-tag size="small" :type="row.matchedSpec===false?'danger':'success'">{{ row.matchedSpec===false?'不符':'一致' }}</el-tag></template>
              </el-table-column>
            </el-table>
            <div v-if="l.photos.length" style="margin-top:4px">
              <el-link v-for="(p,idx) in l.photos" :key="idx" :href="p" target="_blank" type="primary" style="margin-right:10px;font-size:12px">照片{{ idx+1 }}</el-link>
            </div>
          </div>
        </el-card>

        <el-card class="section-card" header="⑧ 验收（按整改项逐条确认）">
          <el-empty v-if="!archive.acceptances.length" description="尚未验收" :image-size="50" />
          <div v-for="a in archive.acceptances" :key="a.id" class="timeline-block">
            <h4>第 {{ a.round }} 次验收　{{ fmt(a.createdAt) }}　{{ a.inspectorName }}
              <el-tag size="small" :type="a.result==='通过'?'success':'danger'" style="margin-left:8px">{{ a.result }}</el-tag>
            </h4>
            <el-table :data="a.items" size="small">
              <el-table-column prop="title" label="整改项" />
              <el-table-column label="结论" width="90">
                <template #default="{ row }"><el-tag size="small" :type="row.passed?'success':'danger'">{{ row.passed?'合格':'不合格' }}</el-tag></template>
              </el-table-column>
              <el-table-column prop="note" label="说明" />
            </el-table>
            <div v-if="a.opinion" style="font-size:13px;margin-top:4px">意见：{{ a.opinion }}</div>
          </div>
        </el-card>
      </el-col>

      <!-- 右列：告知、补助、协商、销号 -->
      <el-col :span="10">
        <el-card class="section-card" header="④ 风险告知与法律文书（签收 / 拒签留置）">
          <el-empty v-if="!archive.notifications.length" description="暂无告知文书" :image-size="50" />
          <div v-for="n in archive.notifications" :key="n.id" class="timeline-block">
            <h4>{{ n.type }}　<el-tag size="small" :type="n.signStatus==='已签收'?'success':n.signStatus==='拒绝签收'?'danger':'warning'">{{ n.signStatus }}</el-tag></h4>
            <div style="font-size:13px">{{ n.content }}</div>
            <div style="font-size:12px;color:#909399;margin-top:4px">{{ fmt(n.createdAt) }}　{{ n.createdByName }}　<span v-if="n.signer">签收人：{{ n.signer }}（{{ n.method }}）</span></div>
            <el-button v-if="n.signStatus==='待签收' && auth.isFarmer" size="small" type="success" @click="signNotify(n.id,'已签收')">签收</el-button>
            <el-button v-if="n.signStatus==='待签收' && auth.isFarmer" size="small" type="danger" @click="signNotify(n.id,'拒绝签收')">拒绝签收（留置送达）</el-button>
          </div>
        </el-card>

        <el-card class="section-card" header="⑤ 施工补助申请与核定">
          <el-empty v-if="!archive.subsidies.length" description="尚未申请补助" :image-size="50" />
          <div v-for="s in archive.subsidies" :key="s.id" class="timeline-block">
            <h4>申请人：{{ s.applicantName }}（{{ diffLabel[s.difficultyType] }}）
              <el-tag size="small" :type="subsidyType[s.status]" style="margin-left:6px">{{ subsidyLabel[s.status] }}</el-tag>
              <el-tag v-if="s.disbursed" size="small" type="success" style="margin-left:6px">已发放 ¥{{ s.approvedAmount }}</el-tag>
            </h4>
            <div style="font-size:13px">申请预算：¥{{ s.totalAmount }}　核定金额：¥{{ s.approvedAmount }}</div>
            <el-table :data="s.budgetItems" size="small" style="margin:4px 0">
              <el-table-column prop="name" label="项目" />
              <el-table-column prop="qty" label="数量" width="70" />
              <el-table-column prop="unit" label="单位" width="60" />
              <el-table-column prop="unitPrice" label="单价" width="80" />
              <el-table-column prop="amount" label="金额" width="90" />
            </el-table>
            <el-collapse>
              <el-collapse-item title="资格/材料校验结果（困难类型·权属·预算·施工队资质）" :name="s.id">
                <div v-for="c in s.checks" :key="c.code" style="font-size:12.5px;margin:2px 0">
                  <span :class="c.passed?'check-pass':'check-fail'">{{ c.passed ? '✓' : '✗' }}</span>
                  <b style="margin-left:4px">{{ c.label }}</b>：{{ c.detail }}
                </div>
              </el-collapse-item>
            </el-collapse>
            <div v-if="s.townshipOpinion" style="font-size:12px">乡镇意见：{{ s.townshipOpinion }}</div>
            <div v-if="s.countyOpinion" style="font-size:12px">县级意见：{{ s.countyOpinion }}</div>
            <el-button v-if="s.status==='TOWNSHIP_REVIEW' && auth.isTownship" size="small" type="primary" @click="openTownshipReview(s)">乡镇初审</el-button>
            <el-button v-if="s.status==='COUNTY_REVIEW' && auth.isCounty" size="small" type="primary" @click="openCountyReview(s)">县级核定</el-button>
            <el-button v-if="s.status==='APPROVED' && !s.disbursed && auth.isCounty" size="small" type="success" @click="disburse(s.id)">发放补助</el-button>
          </div>
        </el-card>

        <el-card class="section-card" header="⑨ 异常事项与基层协商（租户/经营者/老人/村干部/施工队）">
          <el-empty v-if="!archive.issues.length" description="暂无异常事项" :image-size="50" />
          <div v-for="i in archive.issues" :key="i.id" class="timeline-block">
            <h4>{{ issueLabel[i.type] }}
              <el-tag size="small" :type="issueStatusType[i.status]" style="margin-left:6px">{{ issueStatusLabel[i.status] }}</el-tag>
            </h4>
            <div style="font-size:13px">{{ i.description }}</div>
            <div style="font-size:12px;color:#909399">{{ fmt(i.createdAt) }}　{{ i.reportedByName }}</div>
            <el-timeline v-if="i.consultations.length" style="margin-top:6px;padding-left:6px">
              <el-timeline-item v-for="(c,idx) in i.consultations" :key="idx" :timestamp="fmt(c.at)" size="small">
                <b>参与方：{{ c.participants }}</b>
                <div style="font-size:12.5px">{{ c.content }}</div>
              </el-timeline-item>
            </el-timeline>
            <div v-if="i.resolution" style="font-size:12.5px;color:#67c23a">处置结果：{{ i.resolution }}</div>
            <el-button v-if="i.status!=='RESOLVED'" size="small" @click="openConsult(i)">记录协商过程</el-button>
            <el-button v-if="i.status!=='RESOLVED'" size="small" type="success" @click="openResolve(i)">化解</el-button>
          </div>
        </el-card>

        <el-card class="section-card" header="⑩ 县级销号核查（九项制约全部满足方可销号）">
          <el-empty v-if="!prechecks" description="点击右上角“销号核查”查看前置条件" :image-size="50" />
          <template v-else>
            <el-alert :type="prechecks.allPassed?'success':'error'" :closable="false" style="margin-bottom:8px"
              :title="prechecks.allPassed?'全部前置条件已满足，可以销号':'前置条件未全部满足，不能销号（不只是数量销号）'" />
            <div v-for="c in prechecks.checks" :key="c.code" style="font-size:13px;margin:5px 0">
              <span :class="c.passed?'check-pass':'check-fail'">{{ c.passed ? '✓' : '✗' }}</span>
              <b style="margin-left:4px">{{ c.label }}</b>
              <div style="color:#909399;font-size:12px;margin-left:16px">{{ c.detail }}</div>
            </div>
            <el-button v-if="auth.isCounty && prechecks.allPassed" type="success" style="margin-top:8px" @click="closeHouse">同意销号</el-button>
          </template>
        </el-card>
      </el-col>
    </el-row>

    <!-- ===== 弹窗集合 ===== -->
    <el-dialog v-model="dlg.review" title="乡镇住建复核" width="520px">
      <el-form label-width="100px">
        <el-form-item label="复核动作">
          <el-select v-model="reviewForm.action"><el-option label="确认巡查结论" value="确认"/><el-option label="调整风险等级" value="调整"/><el-option label="退回补充巡查" value="退回"/></el-select>
        </el-form-item>
        <el-form-item label="确认风险等级">
          <el-radio-group v-model="reviewForm.confirmedLevel">
            <el-radio-button v-for="(l,k) in riskLabel" :key="k" :label="k">{{ l }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="复核意见"><el-input v-model="reviewForm.opinion" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg.review=false">取消</el-button><el-button type="primary" @click="submitReview">提交复核</el-button></template>
    </el-dialog>

    <el-dialog v-model="dlg.plan" title="制定整改方案" width="560px">
      <el-form label-width="100px">
        <el-form-item label="整改项" required>
          <el-checkbox-group v-model="planForm.itemKeys">
            <el-checkbox v-for="it in planItemMeta" :key="it.key" :label="it.key">
              {{ it.title }}<span v-if="it.requiredCrewLevel" style="color:#909399">（需{{ it.requiredCrewLevel }}资质）</span>
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="整改期限"><el-date-picker v-model="planForm.deadline" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="暂停使用"><el-switch v-model="planForm.stopUseRequired" /></el-form-item>
        <el-form-item label="临时安置"><el-switch v-model="planForm.resettlementRequired" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="planForm.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg.plan=false">取消</el-button><el-button type="primary" @click="submitPlan">下达方案（自动生成告知文书）</el-button></template>
    </el-dialog>

    <el-dialog v-model="dlg.reinspect" title="巡查 / 整改后复查登记" width="600px">
      <el-form label-width="100px">
        <el-form-item label="复查类型"><el-switch v-model="reinspectForm.isRecheck" active-text="整改后复查（销号前必查）" inactive-text="常规巡查/雨季复查" /></el-form-item>
        <el-row :gutter="10">
          <el-col :span="12"><el-form-item label="墙体裂缝">
            <el-radio-group v-model="reinspectForm.wallCracks"><el-radio-button label="NONE">无</el-radio-button><el-radio-button label="MINOR">轻微</el-radio-button><el-radio-button label="SEVERE">严重</el-radio-button></el-radio-group>
          </el-form-item></el-col>
          <el-col :span="12"><el-form-item label="屋面渗漏">
            <el-radio-group v-model="reinspectForm.roofLeak"><el-radio-button label="NONE">无</el-radio-button><el-radio-button label="MINOR">轻微</el-radio-button><el-radio-button label="SEVERE">严重</el-radio-button></el-radio-group>
          </el-form-item></el-col>
          <el-col :span="12"><el-form-item label="地基沉降">
            <el-radio-group v-model="reinspectForm.foundationSettlement"><el-radio-button label="NONE">无</el-radio-button><el-radio-button label="MINOR">轻微</el-radio-button><el-radio-button label="SEVERE">严重</el-radio-button></el-radio-group>
          </el-form-item></el-col>
          <el-col :span="12"><el-form-item label="是否仍加层"><el-switch v-model="reinspectForm.isAddedFloor" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="情况说明"><el-input v-model="reinspectForm.notes" type="textarea" :rows="3" placeholder="如：雨季后山墙裂缝扩展；整改后裂缝已封闭无扩展等" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg.reinspect=false">取消</el-button><el-button type="primary" @click="submitReinspect">提交并重新判定风险</el-button></template>
    </el-dialog>

    <el-dialog v-model="dlg.resettle" title="临时安置安排" width="520px">
      <el-form label-width="100px">
        <el-form-item label="安置人数"><el-input-number v-model="resettleForm.persons" :min="1" /></el-form-item>
        <el-form-item label="安置方式">
          <el-select v-model="resettleForm.arrangement"><el-option label="投亲靠友" value="投亲靠友"/><el-option label="乡集中安置点" value="集中安置点"/><el-option label="发放租赁补贴" value="租赁补贴"/></el-select>
        </el-form-item>
        <el-form-item label="人员构成"><el-input v-model="resettleForm.membersDetail" type="textarea" :rows="2" placeholder="如：户主夫妇、82岁老人1名、2楼经营户1家3口、租户2人" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="resettleForm.note" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg.resettle=false">取消</el-button><el-button type="primary" @click="submitResettle">建立安置安排</el-button></template>
    </el-dialog>

    <el-dialog v-model="dlg.subsidy" title="农户提交施工计划与补助申请" width="720px">
      <el-form label-width="110px">
        <el-form-item label="困难类型">
          <el-select v-model="subsidyForm.difficultyType">
            <el-option v-for="(l,k) in diffLabel" :key="k" :label="l" :value="k" :disabled="k==='NONE'" />
          </el-select>
        </el-form-item>
        <el-form-item label="困难证明"><el-checkbox v-model="subsidyForm.difficultyProof">已提交民政部门困难证明</el-checkbox></el-form-item>
        <el-form-item label="权属证明"><el-checkbox v-model="subsidyForm.ownershipProof">已提交宅基地/不动产权属证明</el-checkbox></el-form-item>
        <el-form-item label="施工队">
          <el-select v-model="subsidyForm.crewId" style="width:420px">
            <el-option v-for="c in crews" :key="c.id" :label="`${c.name}（${c.qualificationLevel}，有效期至${c.validUntil}${c.blacklisted?'，黑名单':''}）`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="预算明细">
          <el-table :data="subsidyForm.budgetItems" size="small" style="width:100%">
            <el-table-column label="项目"><template #default="{row}"><el-input v-model="row.name" size="small" /></template></el-table-column>
            <el-table-column label="数量" width="90"><template #default="{row}"><el-input-number v-model="row.qty" :min="1" :controls="false" size="small" style="width:80px" /></template></el-table-column>
            <el-table-column label="单位" width="80"><template #default="{row}"><el-input v-model="row.unit" size="small" /></template></el-table-column>
            <el-table-column label="单价" width="100"><template #default="{row}"><el-input-number v-model="row.unitPrice" :min="0" :controls="false" size="small" style="width:90px" /></template></el-table-column>
            <el-table-column label="金额" width="90"><template #default="{row}">{{ (row.qty*row.unitPrice).toFixed(2) }}</template></el-table-column>
            <el-table-column width="60"><template #default="{ $index }"><el-button link type="danger" @click="subsidyForm.budgetItems.splice($index,1)">删</el-button></template></el-table-column>
          </el-table>
          <el-button size="small" style="margin-top:6px" @click="subsidyForm.budgetItems.push({name:'',qty:1,unit:'项',unitPrice:0})">＋ 添加预算项</el-button>
          <span style="margin-left:12px">合计：¥{{ subsidyTotal }}</span>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg.subsidy=false">取消</el-button><el-button type="primary" @click="submitSubsidy">提交申请（系统自动四项校验）</el-button></template>
    </el-dialog>

    <el-dialog v-model="dlg.log" title="上传施工记录（材料/照片/阶段进度）" width="680px">
      <el-form label-width="100px">
        <el-form-item label="施工阶段">
          <el-select v-model="logForm.stage">
            <el-option v-for="s in ['材料进场','拆除加层','承重墙加固','屋面修复','主体施工','竣工自查']" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="情况描述"><el-input v-model="logForm.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="材料登记">
          <el-table :data="logForm.materials" size="small" style="width:100%">
            <el-table-column label="材料" width="100"><template #default="{row}"><el-input v-model="row.name" size="small" /></template></el-table-column>
            <el-table-column label="品牌" width="100"><template #default="{row}"><el-input v-model="row.brand" size="small" /></template></el-table-column>
            <el-table-column label="规格" width="110"><template #default="{row}"><el-input v-model="row.spec" size="small" /></template></el-table-column>
            <el-table-column label="批次" width="90"><template #default="{row}"><el-input v-model="row.batch" size="small" /></template></el-table-column>
            <el-table-column label="数量" width="70"><template #default="{row}"><el-input-number v-model="row.qty" :controls="false" :min="1" size="small" style="width:60px" /></template></el-table-column>
            <el-table-column label="合格证/检测报告"><template #default="{row}"><el-input v-model="row.cert" size="small" placeholder="报告编号" /></template></el-table-column>
            <el-table-column width="60"><template #default="{ $index }"><el-button link type="danger" @click="logForm.materials.splice($index,1)">删</el-button></template></el-table-column>
          </el-table>
          <el-button size="small" style="margin-top:6px" @click="logForm.materials.push({name:'',brand:'',spec:'',batch:'',qty:1,cert:''})">＋ 添加材料</el-button>
        </el-form-item>
        <el-form-item label="照片URL"><el-input v-model="logForm.photosText" type="textarea" :rows="2" placeholder="多个地址用逗号或换行分隔（演示环境可填占位URL）" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg.log=false">取消</el-button><el-button type="primary" @click="submitLog">上传记录</el-button></template>
    </el-dialog>

    <el-dialog v-model="dlg.acceptance" title="按整改项逐条验收" width="640px">
      <el-table :data="acceptForm.items" size="small">
        <el-table-column prop="title" label="整改项" />
        <el-table-column label="结论" width="170">
          <template #default="{ row }">
            <el-radio-group v-model="row.passed"><el-radio-button :label="true">合格</el-radio-button><el-radio-button :label="false">不合格</el-radio-button></el-radio-group>
          </template>
        </el-table-column>
        <el-table-column label="说明"><template #default="{ row }"><el-input v-model="row.note" size="small" placeholder="现场核查情况" /></template></el-table-column>
      </el-table>
      <el-form label-width="100px" style="margin-top:10px">
        <el-form-item label="验收照片URL"><el-input v-model="acceptForm.photosText" type="textarea" :rows="2" placeholder="多个地址逗号分隔（必传）" /></el-form-item>
        <el-form-item label="验收意见"><el-input v-model="acceptForm.opinion" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg.acceptance=false">取消</el-button><el-button type="primary" @click="submitAcceptance">提交验收结论</el-button></template>
    </el-dialog>

    <el-dialog v-model="dlg.issue" title="登记异常/协商事项" width="520px">
      <el-form label-width="100px">
        <el-form-item label="事项类型">
          <el-select v-model="issueForm.type" style="width:100%">
            <el-option v-for="(l,k) in issueLabel" :key="k" :label="l" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="情况描述"><el-input v-model="issueForm.description" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg.issue=false">取消</el-button><el-button type="warning" @click="submitIssue">登记</el-button></template>
    </el-dialog>

    <el-dialog v-model="dlg.consult" title="记录协商过程" width="520px">
      <el-form label-width="100px">
        <el-form-item label="参与方"><el-input v-model="consultForm.participants" placeholder="如：村支书、户主、户主母亲（82岁）、2楼租户、施工队周工" /></el-form-item>
        <el-form-item label="协商内容"><el-input v-model="consultForm.content" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg.consult=false">取消</el-button><el-button type="primary" @click="submitConsult">追加协商记录</el-button></template>
    </el-dialog>

    <el-dialog v-model="dlg.resolve" title="化解事项" width="520px">
      <el-form label-width="100px">
        <el-form-item label="处置结果"><el-input v-model="resolveForm.resolution" type="textarea" :rows="4" placeholder="偷换材料须写明返工/更换合格材料的处置" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg.resolve=false">取消</el-button><el-button type="success" @click="submitResolve">确认化解</el-button></template>
    </el-dialog>

    <el-dialog v-model="dlg.twReview" title="乡镇初审补助" width="560px">
      <el-form label-width="110px">
        <el-form-item label="核验权属"><el-checkbox v-model="twForm.ownershipVerified">现场核验房屋权属清晰</el-checkbox></el-form-item>
        <el-form-item label="困难类型认定">
          <el-select v-model="twForm.difficultyType"><el-option v-for="(l,k) in diffLabel" :key="k" :label="l" :value="k" /></el-select>
        </el-form-item>
        <el-form-item label="建议核定金额"><el-input-number v-model="twForm.approvedAmount" :min="0" :step="1000" /></el-form-item>
        <el-form-item label="初审意见"><el-input v-model="twForm.opinion" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="danger" @click="twReject">驳回</el-button>
        <el-button type="primary" @click="twApprove">核验通过并上报县级</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dlg.ctReview" title="县级核定补助" width="480px">
      <el-form label-width="100px">
        <el-form-item label="核定金额"><el-input-number v-model="ctForm.approvedAmount" :min="0" :step="1000" /></el-form-item>
        <el-form-item label="核定意见"><el-input v-model="ctForm.opinion" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button type="danger" @click="ctReject">不予通过</el-button><el-button type="primary" @click="ctApprove">核定通过</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../api';
import {
  RISK_LABEL as riskLabel, RISK_TYPE as riskType,
  STATUS_LABEL as statusLabel, STATUS_TYPE as statusType,
  SEVERITY_LABEL as sevLabel, SEVERITY_TYPE as sevType,
  DIFFICULTY_LABEL as diffLabel,
  SUBSIDY_STATUS_LABEL as subsidyLabel, SUBSIDY_STATUS_TYPE as subsidyType,
  ISSUE_LABEL as issueLabel, ISSUE_STATUS_LABEL as issueStatusLabel, ISSUE_STATUS_TYPE as issueStatusType,
} from '../dict';
import { useAuth } from '../store';

const route = useRoute();
const auth = useAuth();
const archive = ref(null);
const prechecks = ref(null);
const crews = ref([]);
const planItemMeta = ref([]);

const h = computed(() => archive.value.house);
const isHighRisk = computed(() => ['STOP', 'EVACUATE'].includes(h.value.riskLevel));
const canReview = computed(() => auth.isTownship && ['INSPECTED', 'REBOUND', 'RECTIFYING'].includes(h.value.status));
const canAccept = computed(() => auth.isTownship && ['RECTIFYING', 'ACCEPTANCE_FAIL'].includes(h.value.status));

const dlg = reactive({ review: false, plan: false, reinspect: false, resettle: false, subsidy: false, log: false, acceptance: false, issue: false, consult: false, resolve: false, twReview: false, ctReview: false });

const reviewForm = reactive({ action: '确认', confirmedLevel: 'WATCH', opinion: '' });
const planForm = reactive({ itemKeys: [], deadline: '2026-12-31', stopUseRequired: false, resettlementRequired: false, remark: '' });
const reinspectForm = reactive({ isRecheck: false, wallCracks: 'NONE', roofLeak: 'NONE', foundationSettlement: 'NONE', isAddedFloor: false, notes: '' });
const resettleForm = reactive({ persons: 1, arrangement: '投亲靠友', membersDetail: '', note: '' });
const subsidyForm = reactive({ difficultyType: 'DIBAO', difficultyProof: true, ownershipProof: true, crewId: '', budgetItems: [{ name: '承重墙加固', qty: 1, unit: '项', unitPrice: 18000 }] });
const logForm = reactive({ stage: '材料进场', description: '', materials: [], photosText: '' });
const acceptForm = reactive({ items: [], photosText: '', opinion: '' });
const issueForm = reactive({ type: 'REFUSE_FIX', description: '' });
const consultForm = reactive({ participants: '', content: '' });
const resolveForm = reactive({ resolution: '' });
const twForm = reactive({ appId: '', ownershipVerified: true, difficultyType: 'DIBAO', approvedAmount: 0, opinion: '' });
const ctForm = reactive({ appId: '', approvedAmount: 0, opinion: '' });
let activeIssueId = '';

const subsidyTotal = computed(() => subsidyForm.budgetItems.reduce((s, b) => s + b.qty * b.unitPrice, 0));
function fmt(t) { return t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : ''; }

async function load() {
  archive.value = await api.get(`/houses/${route.params.id}/archive`);
  prechecks.value = null;
}

async function loadPrecheck() {
  prechecks.value = await api.get(`/houses/${route.params.id}/closure-prechecks`);
}

function openPlan() {
  planForm.itemKeys = [];
  planForm.stopUseRequired = ['STOP', 'EVACUATE'].includes(h.value.riskLevel);
  planForm.resettlementRequired = h.value.riskLevel === 'EVACUATE';
  dlg.plan = true;
}
async function submitPlan() {
  if (!planForm.itemKeys.length) return ElMessage.warning('至少选择一个整改项');
  await api.post(`/houses/${h.value.id}/plans`, planForm);
  ElMessage.success('整改方案已下达，告知文书已生成');
  dlg.plan = false;
  await load();
}
async function submitReview() {
  reviewForm.confirmedLevel = reviewForm.confirmedLevel || h.value.riskLevel;
  await api.post(`/houses/${h.value.id}/review`, reviewForm);
  ElMessage.success('复核完成');
  dlg.review = false;
  await load();
}
async function startRect() {
  await api.post(`/houses/${h.value.id}/start-rectification`, {});
  ElMessage.success('整改已启动');
  await load();
}
async function confirmStop() {
  const { value } = await ElMessageBox.prompt('封停确认说明', '现场封停确认', { inputType: 'textarea', inputValue: '已张贴封条、设置警示标志，确认无人员居住/经营' });
  await api.post(`/houses/${h.value.id}/stop-use`, { note: value });
  ElMessage.success('已确认封停停用');
  await load();
}
async function submitReinspect() {
  await api.post(`/houses/${h.value.id}/reinspect`, reinspectForm);
  ElMessage.success('复查已提交，风险已重新判定');
  dlg.reinspect = false;
  await load();
}
async function submitResettle() {
  await api.post(`/houses/${h.value.id}/resettlements`, resettleForm);
  ElMessage.success('安置安排已建立（仍需确认实际转移）');
  dlg.resettle = false;
  await load();
}
async function transferDone(rid) {
  await api.post(`/resettlements/${rid}/transfer`, { note: '经协商全部人员已转移' });
  ElMessage.success('已确认人员实际转移');
  await load();
}
async function returnHome(rid) {
  await api.post(`/resettlements/${rid}/return`, { note: '验收合格，安全返回' });
  ElMessage.success('已确认返回');
  await load();
}
async function signNotify(nid, signStatus) {
  const { value: signer } = await ElMessageBox.prompt('签收人姓名', signStatus, { inputValue: h.value.ownerName });
  await api.post(`/notifications/${nid}/sign`, { signStatus, signer });
  ElMessage.success(signStatus === '已签收' ? '已签收' : '已按留置送达留痕');
  await load();
}
async function openSubsidy() {
  subsidyForm.difficultyType = h.value.difficultyType === 'NONE' ? 'DIBAO' : h.value.difficultyType;
  dlg.subsidy = true;
}
async function submitSubsidy() {
  if (!subsidyForm.crewId) return ElMessage.warning('请选择施工队');
  const payload = { ...subsidyForm, applicantName: h.value.ownerName };
  await api.post(`/houses/${h.value.id}/subsidies`, payload);
  ElMessage.success('申请已提交，进入乡镇初审（校验结果可展开查看）');
  dlg.subsidy = false;
  await load();
}
async function openTownshipReview(s) {
  twForm.appId = s.id;
  twForm.difficultyType = s.difficultyType;
  twForm.approvedAmount = Number(s.totalAmount);
  twForm.opinion = '';
  dlg.twReview = true;
}
async function twApprove() {
  await api.post(`/subsidies/${twForm.appId}/township-review`, {
    action: 'approve', ownershipVerified: twForm.ownershipVerified,
    difficultyType: twForm.difficultyType, approvedAmount: twForm.approvedAmount, opinion: twForm.opinion,
  });
  ElMessage.success('已上报县级核定');
  dlg.twReview = false;
  await load();
}
async function twReject() {
  await api.post(`/subsidies/${twForm.appId}/township-review`, { action: 'reject', opinion: twForm.opinion || '资格/材料不符' });
  ElMessage.success('已驳回并生成告知决定');
  dlg.twReview = false;
  await load();
}
async function openCountyReview(s) {
  ctForm.appId = s.id;
  ctForm.approvedAmount = Number(s.approvedAmount || s.totalAmount);
  dlg.ctReview = true;
}
async function ctApprove() {
  await api.post(`/subsidies/${ctForm.appId}/county-review`, { action: 'approve', approvedAmount: ctForm.approvedAmount, opinion: ctForm.opinion });
  ElMessage.success('县级核定通过');
  dlg.ctReview = false;
  await load();
}
async function ctReject() {
  await api.post(`/subsidies/${ctForm.appId}/county-review`, { action: 'reject', opinion: ctForm.opinion });
  ElMessage.success('已作出不予通过决定');
  dlg.ctReview = false;
  await load();
}
async function disburse(id) {
  await api.post(`/subsidies/${id}/disburse`, {});
  ElMessage.success('补助已发放');
  await load();
}
async function submitLog() {
  const photos = logForm.photosText.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
  await api.post(`/houses/${h.value.id}/construction-logs`, { ...logForm, photos });
  ElMessage.success('施工记录已上传');
  dlg.log = false;
  logForm.description = ''; logForm.materials = []; logForm.photosText = '';
  await load();
}
async function markDone(key, done) {
  await api.post(`/houses/${h.value.id}/plan-item-done`, { key, done });
  ElMessage.success('施工完成状态已更新');
  await load();
}
async function openAcceptance() {
  const plan = archive.value.plans[0];
  acceptForm.items = plan.items.map((i) => ({ key: i.key, title: i.title, passed: true, note: '' }));
  acceptForm.photosText = 'https://example.com/accept-' + plan.id.slice(0, 6) + '-1.jpg';
  acceptForm.opinion = '';
  dlg.acceptance = true;
}
async function submitAcceptance() {
  const photos = acceptForm.photosText.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
  await api.post(`/houses/${h.value.id}/acceptance`, { items: acceptForm.items, photos, opinion: acceptForm.opinion });
  ElMessage.success('验收结论已提交');
  dlg.acceptance = false;
  await load();
}
async function submitIssue() {
  await api.post(`/houses/${h.value.id}/issues`, issueForm);
  ElMessage.success('事项已登记到房屋档案');
  dlg.issue = false;
  issueForm.description = '';
  await load();
}
function openConsult(i) { activeIssueId = i.id; consultForm.participants = ''; consultForm.content = ''; dlg.consult = true; }
async function submitConsult() {
  await api.post(`/issues/${activeIssueId}/consultations`, consultForm);
  ElMessage.success('协商过程已留痕');
  dlg.consult = false;
  await load();
}
function openResolve(i) { activeIssueId = i.id; resolveForm.resolution = i.type === 'MATERIAL_FRAUD' ? '已责令拆除不合格材料、更换合格材料并复检，检测报告编号：' : ''; dlg.resolve = true; }
async function submitResolve() {
  await api.post(`/issues/${activeIssueId}/resolve`, resolveForm);
  ElMessage.success('事项已化解');
  dlg.resolve = false;
  await load();
}
async function closeHouse() {
  await api.post(`/houses/${h.value.id}/close`, { opinion: '九项核查通过，同意销号' });
  ElMessage.success('房屋档案已销号');
  await load();
  await loadPrecheck();
}

onMounted(async () => {
  await load();
  reviewForm.confirmedLevel = h.value.riskLevel;
  reinspectForm.wallCracks = h.value.wallCracks;
  reinspectForm.roofLeak = h.value.roofLeak;
  reinspectForm.foundationSettlement = h.value.foundationSettlement;
  reinspectForm.isAddedFloor = h.value.isAddedFloor;
  try { crews.value = await api.get('/construction-crews'); } catch { /* ignore */ }
  try { planItemMeta.value = await api.get('/meta/plan-items'); } catch { /* ignore */ }
});
</script>

<style scoped>
.head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
.h-title { display: flex; gap: 8px; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; max-width: 520px; justify-content: flex-end; }
</style>
