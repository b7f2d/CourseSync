// SPDX-License-Identifier: GPL-3.0-only
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {randomBytes, randomUUID} = require('node:crypto');

async function main() {
  const files = new Map();
  const keys = new Map();
  const requests = [];
  const results = [];
  const events = [];
  const calendar = {identifier:'calendar-1', title:'课表', allowsContentModifications:true,
    isSubscribed:false, source:{title:'iCloud',type:'calDAV'}};
  const table = '/student/for-std/course-table';
  const page = `personId = 1; currentSemester = {"id": 1};
    <select id="allSemesters"><option value="1">2026-2027-1</option></select>`;
  const course = {courseName:'测试课程', weekday:1, weekIndexes:[1], startUnit:1, endUnit:2,
    startTime:'08:00', endTime:'09:40', room:'测试教室'};
  let cancel = true;
  let created = false;
  let authenticated = false;
  let writes = 0;
  let time = Date.now();
  class TestDate extends Date {
    static now() {return time;}
  }
  const mock = {
    Date:TestDate,
    __native(operation, value) {
      switch (operation) {
        case 'root': return '/data';
        case 'uuid': return randomUUID();
        case 'random': return [...randomBytes(value.count)];
        case 'exists': return files.has(value.path);
        case 'mkdir': files.set(value.path, null); return true;
        case 'list':
          return [...files.keys()].filter(key => path.posix.dirname(key) === value.path).map(key => path.posix.basename(key));
        case 'read':
          assert(files.has(value.path));
          return files.get(value.path);
        case 'write': files.set(value.path, value.value); return true;
        case 'unlink': return files.delete(value.path);
        case 'move':
          assert(files.has(value.path));
          assert(!files.has(value.to));
          files.set(value.to, files.get(value.path));
          files.delete(value.path);
          return true;
        case 'keyRead': return keys.get(value.key) ?? null;
        case 'keyWrite': keys.set(value.key, value.value); return true;
        case 'keyDelete': keys.delete(value.key); return true;
        case 'removePending': return true;
        case 'progress': return true;
        case 'events':
          assert.deepEqual([...value.calendars], [calendar.identifier]);
          return events.filter(event => event.startDate < value.end && event.endDate > value.start);
        case 'saveEvent': {
          writes++;
          assert.equal(value.calendar, calendar.identifier);
          const index = value.handle ? events.findIndex(event => event.handle === value.handle) : events.length;
          assert(index >= 0);
          const identifier = events[index]?.identifier || randomUUID();
          events[index] = {...value, identifier, handle:identifier, calendar, startDate:value.start, endDate:value.end};
          return {identifier,handle:identifier};
        }
        default: throw new Error(operation);
      }
    },
    __asyncNative(operation, value, callback) {
      requests.push([operation, value]);
      if (operation === 'pending') return callback([], null);
      if (operation === 'dialog' && value.title === '请选择你的学校') return callback(0, null);
      if (operation === 'fields' && value.title === '学校账号密码') {
        assert.equal(value.fields[1].secure, true);
        return callback(cancel ? null : ['test-user','test-password'], null);
      }
      if (operation === 'fields' && value.title === '创建 iCloud 日历') return callback([calendar.title], null);
      if (operation === 'dialog' && value.title === 'CourseSync') return callback(0, null);
      if (operation === 'calendars') return callback(created ? [calendar] : [{...calendar,identifier:'unrelated'}], null);
      if (operation === 'newCalendar') {
        assert.equal(created, false);
        assert.equal(value.title, calendar.title);
        created = true;
        return callback(calendar, null);
      }
      if (operation === 'request') {
        time += 1100;
        const url = new URL(value.url);
        const respond = (text, status = 200, headers = {}, redirect = '') =>
          callback({text,status,headers,redirect,mimeType:'text/html'}, null);
        if (url.pathname === table) {
          if (authenticated) assert.match(value.headers.Cookie, /TEST_SESSION=verified/);
          return respond(authenticated ? page : '');
        }
        if (url.pathname === '/student/sso/login') return respond('', 302, {}, 'https://authserver.nufe.edu.cn/authserver/login');
        if (url.pathname.endsWith('/bfp/info')) return respond('');
        if (url.pathname.endsWith('/checkNeedCaptcha.htl')) return respond('{"isNeed":false}');
        if (url.pathname === '/authserver/login' && value.method === 'GET') {
          return respond('<form id="pwdFromId"><input id="pwdEncryptSalt" value="1234567890abcdef"><input name="execution" value="test"></form>');
        }
        if (url.pathname === '/authserver/login' && value.method === 'POST') {
          const body = new URLSearchParams(value.body);
          assert.equal(body.get('username'), 'test-user');
          assert.match(body.get('password'), /^[A-Za-z0-9+/]+=*$/);
          assert.equal(keys.has('CourseSync.Local.v1.saved-login'), false);
          assert.equal(keys.has('CourseSync.v1.icloud-credentials'), false);
          authenticated = true;
          return respond('', 302, {'set-cookie':'TEST_SESSION=verified; Domain=nufe.edu.cn; Path=/'},
            'https://jwxt.nufe.edu.cn' + table);
        }
        if (url.pathname === '/student/for-std/exam-arrange') return respond('<table id="exams"><tr class="tr-empty"><td>暂无考试</td></tr></table>');
        if (url.pathname === table + '/semester/1/print-data') {
          return respond(JSON.stringify({studentTableVms:[{activities:[course]}]}));
        }
        throw new Error('Unexpected simulated school endpoint ' + url.pathname);
      }
      if (operation === 'dialog') return callback(0, null);
      throw new Error(operation);
    },
    __delay() {},
    __finish(message) {results.push(message);}
  };
  const resource = path.join(__dirname, 'build', 'Payload', 'CourseSync.app', 'CourseSync.js');
  const script = new vm.Script(fs.readFileSync(resource, 'utf8'));
  async function launch() {
    const context = vm.createContext({...mock});
    script.runInContext(context);
    await context.__COURSESYNC_LAUNCH__;
  }
  await launch();
  assert.deepEqual(requests.map(([name]) => name), ['pending', 'dialog', 'fields'], JSON.stringify(requests));
  assert.equal(requests[2][1].fields[1].secure, true);
  assert.deepEqual(results, ['']);
  assert(![...files.keys()].some(name => name.endsWith('/run-lock.json')));
  cancel = false;
  await launch();
  assert.match(results.at(-1), /^刷新成功/, JSON.stringify(results));
  assert.equal(events.length, 1);
  assert.equal(events[0].startDate, Date.parse('2026-09-07T08:00:00+08:00'));
  assert.equal(events[0].location, '测试教室');
  assert.equal(writes, 2); // Create the event, then replace the recovery marker with readable notes.
  assert(keys.has('CourseSync.v1.icloud-credentials'));
  const firstWriteCount = writes;
  const firstIdentifier = events[0].identifier;
  await launch();
  assert.match(results.at(-1), /^刷新成功/, JSON.stringify(results));
  assert.equal(events.length, 1);
  assert.equal(events[0].identifier, firstIdentifier);
  assert.equal(writes, firstWriteCount);
  assert.equal(requests.filter(([name, value]) => name === 'fields' && value.title === '学校账号密码').length, 2);
  console.log('Standalone cancellation, login, calendar write and repeat sync passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

