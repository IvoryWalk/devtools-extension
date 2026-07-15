/**
 * SQL工具测试脚本（整合版）
 * 覆盖 DML 美化、DDL 美化、净化、语法高亮、注释处理等场景
 * 运行: node test-sql.js
 */
const SqlTools = require('./js/modules/sql-tools.js');

const testCases = [
    // ─── DML 基础 ───
    { name: '简单SELECT', input: 'select id,name,age from user where age > 18 order by create_time desc limit 10' },
    { name: '多表JOIN', input: 'select u.id,u.name,o.order_no,o.amount from user u left join order o on u.id = o.user_id inner join order_item oi on o.id = oi.order_id where o.status = 1 group by u.id' },
    { name: 'INSERT多值', input: "insert into user (id,name,age,create_time) values (1,'张三',25,now()),(2,'李四',30,now())" },
    { name: 'UPDATE语句', input: "update user set name='王五',age=28 where id=1 and status=1" },
    { name: 'DELETE语句', input: 'delete from user where status = 0 and create_time < "2020-01-01"' },
    { name: 'REPLACE INTO', input: "replace into user (id,name,age) values (1,'张三',26)" },

    // ─── DML 进阶 ───
    { name: '子查询嵌套', input: 'select * from user where id in (select user_id from order where amount > 100 and status in (1,2))' },
    { name: '多层嵌套子查询', input: 'select * from (select id,name,row_number() over (partition by dept_id order by salary desc) as rn from employee) t where rn <= 3' },
    { name: 'CASE WHEN', input: "select id,name,case when age < 18 then '未成年' when age between 18 and 60 then '成年' else '老年' end as age_type from user" },
    { name: 'UNION查询', input: 'select id,name from user where status = 1 union all select id,name from user_bak where status = 1' },
    { name: 'EXISTS查询', input: 'select * from user u where exists (select 1 from order o where o.user_id = u.id and o.amount > 1000)' },
    { name: '聚合HAVING', input: 'select dept_id,count(*) as cnt,avg(salary) as avg_sal from employee group by dept_id having cnt > 10 and avg_sal > 10000' },
    { name: 'BETWEEN AND', input: 'select * from order where create_time between "2024-01-01" and "2024-12-31" and status between 1 and 3' },
    { name: 'LIKE模糊查询', input: "select * from user where name like '%张%' and phone like '138%' and address not like '%测试%'" },
    { name: 'ON DUPLICATE KEY UPDATE', input: "insert into user_stat (user_id,login_count,last_login_time) values (1,1,now()) on duplicate key update login_count = login_count + 1, last_login_time = now()" },
    { name: '字符串包含关键字', input: "select id,name from user where name = 'select from where' and desc = '这是一个测试and or'" },

    // ─── DDL ───
    { name: 'CREATE TABLE', input: 'create table if not exists user (id int primary key auto_increment, name varchar(50) not null, age int default 0, create_time datetime default current_timestamp, key idx_name(name)) engine=innodb default charset=utf8mb4' },
    { name: 'ALTER TABLE ADD', input: 'alter table user add column email varchar(100) after name, add index idx_email(email)' },
    { name: 'ALTER TABLE MODIFY', input: 'alter table user modify column age tinyint unsigned not null default 0 comment "年龄"' },
    { name: 'CREATE INDEX', input: 'create index idx_status_create_time on user(status, create_time desc)' },
    { name: 'DROP TABLE', input: 'drop table if exists user_bak' },
    { name: 'TRUNCATE TABLE', input: 'truncate table user_log' },

    // ─── 注释处理 ───
    { name: '行注释', input: '-- 查询成年用户\nselect id,name from user where age > 18 -- 过滤条件\nand status = 1' },
    { name: '块注释', input: 'select id,name /* 用户ID和姓名 */,age from user where status = 1 /* 正常用户 */' },
    { name: '混合注释', input: `-- 查询用户SQL
select id, name /* 用户ID和姓名 */, age from user # 过滤条件
where age > 18 -- 成年用户
and status = 1 /* 正常状态 */` },
];

let passed = 0, failed = 0;

console.log('🧪 SQL工具测试（整合版）\n');
console.log(`共 ${testCases.length} 个用例，每个测试 format + clean\n\n`);

for (const tc of testCases) {
    console.log(`━`.repeat(70));
    console.log(`📝 ${tc.name}`);
    console.log(`   输入: ${tc.input.slice(0, 80)}${tc.input.length > 80 ? '...' : ''}`);

    for (const func of ['format', 'clean']) {
        try {
            const result = SqlTools[func](tc.input);
            if (result.success) {
                console.log(`  ✅ ${func} OK`);
                passed++;
            } else {
                console.log(`  ❌ ${func} FAIL: ${result.error}`);
                failed++;
            }
        } catch (e) {
            console.log(`  💥 ${func} 异常: ${e.message}`);
            failed++;
        }
    }
}
console.log(`━`.repeat(70));
console.log(`\n🏁 测试完成: ✅ ${passed} 通过 / ❌ ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
