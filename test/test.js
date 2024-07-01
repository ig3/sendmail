'use strict';

const mock = require('mock-require');
let spawnArguments;
let spawnThrow;
let spawnError;
let endMessage;
let onExitCallback;
let onErrorCallback;
let sendmailExitCode = 0;
mock('child_process', {
  spawn: function () {
    if (spawnThrow) {
      throw spawnThrow;
    }
    if (spawnError) {
      setTimeout(
        () => {
          if (onErrorCallback) {
            onErrorCallback(spawnError);
          } else {
            throw spawnError;
          }
        },
        10
      );
    }
    spawnArguments = arguments;
    return {
      on: function (event, callback) {
        if (event === 'exit') {
          onExitCallback = callback;
        } else if (event === 'error') {
          onErrorCallback = callback;
        } else {
          assert.fail('Unmocked event handler');
        }
      },
      stdin: {
        end: function (msg) {
          endMessage = msg;
          if (!spawnError && !spawnThrow) {
            onExitCallback(sendmailExitCode);
          } else {
            console.log('end called. Not calling exit callback');
          }
        },
      },
    };
  },
});

const assert = require('node:assert/strict');
const t = require('node:test');

const sendmail = require('../index.js');

t.test('mandatory options', async t => {
  await t.test('all required options', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    });
  });
  await t.test('missing from option', t => {
    return sendmail({
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .catch(err => {
      assert.deepEqual(err, new Error('Missing from address'), 'Missing from');
    });
  });
  await t.test('missing to option', t => {
    return sendmail({
      from: 'from@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .catch(err => {
      assert.deepEqual(err, new Error('Missing to address'), 'Missing to');
    });
  });
  await t.test('missing subject option', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      body: 'This is the body',
    })
    .catch(err => {
      assert.deepEqual(err, new Error('Missing subject'), 'Missing subject');
    });
  });
  await t.test('Missing body option', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
    })
    .catch(err => {
      assert.deepEqual(err, new Error('Missing body'), 'Missing body');
    });
  });
});

t.test('sendmail command', async t => {
  await t.test('basic plain text', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      assert.equal(spawnArguments.length, 2, 'arguments length');
      assert.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      assert.deepEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      assert.equal(lines[0], 'To: to@example.com', 'line 1');
      assert.equal(lines[1], 'From: from@example.com', 'line 2');
      assert.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      assert.equal(lines[3], 'Subject: Test subject', 'line 4');
      assert.equal(lines[4], '', 'line 5');
      assert.equal(lines[5], 'This is the body', 'line 6');
      assert.equal(lines[6], '', 'line 7');
    });
  });

  await t.test('with envelopeFrom', t => {
    return sendmail({
      from: 'from@example.com',
      envelopeFrom: 'test@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      assert.equal(spawnArguments.length, 2, 'arguments length');
      assert.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      assert.deepStrictEqual(spawnArguments[1], ['-i', '-t', '-f', 'test@example.com'], 'args');
      const lines = endMessage.split('\n');
      assert.equal(lines[0], 'To: to@example.com', 'line 1');
      assert.equal(lines[1], 'From: from@example.com', 'line 2');
      assert.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      assert.equal(lines[3], 'Subject: Test subject', 'line 4');
      assert.equal(lines[4], '', 'line 5');
      assert.equal(lines[5], 'This is the body', 'line 6');
      assert.equal(lines[6], '', 'line 7');
    });
  });

  await t.test('with bodyType html', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
    })
    .then(() => {
      assert.equal(spawnArguments.length, 2, 'arguments length');
      assert.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      assert.deepStrictEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 16, 'Message body is 16 lines');
      assert.equal(lines[0], 'To: to@example.com', 'line 1');
      assert.equal(lines[1], 'From: from@example.com', 'line 2');
      assert.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      assert.equal(lines[3], 'Subject: Test subject', 'line 4');
      assert.equal(lines[4], 'Mime-Version: 1.0', 'line 5');
      assert.equal(lines[5], 'Content-Type: multipart/alternative; boundary=boundary', 'line 6');
      assert.equal(lines[6], 'Content-Disposition: inline', 'line 7');
      assert.equal(lines[7], '', 'line 8');
      assert.equal(lines[8], '--boundary', 'line 9');
      assert.equal(lines[9], 'Content-Type: text/html; charset=utf-8', 'line 10');
      assert.equal(lines[10], 'Content-Transfer-Encoding: Base64', 'line 11');
      assert.equal(lines[11], 'Content-Disposition: inline', 'line 12');
      assert.equal(lines[12], '', 'line 13');
      assert.equal(lines[13], 'VGhpcyBpcyB0aGUgYm9keQ==', 'line 14');
      assert.equal(lines[14], '', 'line 15');
      assert.equal(lines[15], '--boundary--', 'line 16');
    });
  });

  await t.test('with bodyType html and plaintext', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
      plaintext: 'This is the plain text',
    })
    .then(() => {
      assert.equal(spawnArguments.length, 2, 'arguments length');
      assert.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      assert.deepStrictEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 22, 'Message body is 22 lines');
      assert.equal(lines[0], 'To: to@example.com', 'line 1');
      assert.equal(lines[1], 'From: from@example.com', 'line 2');
      assert.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      assert.equal(lines[3], 'Subject: Test subject', 'line 4');
      assert.equal(lines[4], 'Mime-Version: 1.0', 'line 5');
      assert.equal(lines[5], 'Content-Type: multipart/alternative; boundary=boundary', 'line 6');
      assert.equal(lines[6], 'Content-Disposition: inline', 'line 7');
      assert.equal(lines[7], '', 'line 8');
      assert.equal(lines[8], '--boundary', 'line 9');
      assert.equal(lines[9], 'Content-Type: text/html; charset=utf-8', 'line 10');
      assert.equal(lines[10], 'Content-Transfer-Encoding: Base64', 'line 11');
      assert.equal(lines[11], 'Content-Disposition: inline', 'line 12');
      assert.equal(lines[12], '', 'line 13');
      assert.equal(lines[13], 'VGhpcyBpcyB0aGUgYm9keQ==', 'line 14');
      assert.equal(lines[14], '', 'line 15');
      assert.equal(lines[15], '--boundary', 'line 16');
      assert.equal(lines[16], 'Content-Type: text/plain; charset=utf-8', 'line 17');
      assert.equal(lines[17], 'Content-Disposition: inline', 'line 18');
      assert.equal(lines[18], '', 'line 19');
      assert.equal(lines[19], 'This is the plain text', 'line 20');
      assert.equal(lines[20], '', 'line 21');
      assert.equal(lines[21], '--boundary--', 'line 22');
    });
  });

  await t.test('with "--boundary " in plaintext', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
      plaintext: 'This is the plain text\n--boundary \nMore plain text',
    })
    .then(() => {
      assert.equal(spawnArguments.length, 2, 'arguments length');
      assert.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      assert.deepStrictEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 24, 'Message body is 24 lines');
      assert.equal(lines[0], 'To: to@example.com', 'line 1');
      assert.equal(lines[1], 'From: from@example.com', 'line 2');
      assert.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      assert.equal(lines[3], 'Subject: Test subject', 'line 4');
      assert.equal(lines[4], 'Mime-Version: 1.0', 'line 5');
      assert.equal(lines[5], 'Content-Type: multipart/alternative; boundary=boundary', 'line 6');
      assert.equal(lines[6], 'Content-Disposition: inline', 'line 7');
      assert.equal(lines[7], '', 'line 8');
      assert.equal(lines[8], '--boundary', 'line 9');
      assert.equal(lines[9], 'Content-Type: text/html; charset=utf-8', 'line 10');
      assert.equal(lines[10], 'Content-Transfer-Encoding: Base64', 'line 11');
      assert.equal(lines[11], 'Content-Disposition: inline', 'line 12');
      assert.equal(lines[12], '', 'line 13');
      assert.equal(lines[13], 'VGhpcyBpcyB0aGUgYm9keQ==', 'line 14');
      assert.equal(lines[14], '', 'line 15');
      assert.equal(lines[15], '--boundary', 'line 16');
      assert.equal(lines[16], 'Content-Type: text/plain; charset=utf-8', 'line 17');
      assert.equal(lines[17], 'Content-Disposition: inline', 'line 18');
      assert.equal(lines[18], '', 'line 19');
      assert.equal(lines[19], 'This is the plain text', 'line 20');
      assert.equal(lines[20], '--boundary ', 'line 21');
      assert.equal(lines[21], 'More plain text', 'line 23');
      assert.equal(lines[22], '', 'line 24');
      assert.equal(lines[23], '--boundary--', 'line 25');
    });
  });

  await t.test('with "--boundary" in plaintext', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
      plaintext: 'This is the plain text\n--boundary\nMore plain text',
    })
    .then(() => {
      assert.equal(spawnArguments.length, 2, 'arguments length');
      assert.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      assert.deepStrictEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 24, 'Message body is 24 lines');
      assert.equal(lines[0], 'To: to@example.com', 'line 1');
      assert.equal(lines[1], 'From: from@example.com', 'line 2');
      assert.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      assert.equal(lines[3], 'Subject: Test subject', 'line 4');
      assert.equal(lines[4], 'Mime-Version: 1.0', 'line 5');
      // TODO: test against re and extract the actual bondary
      assert.notEqual(lines[5], 'Content-Type: multipart/alternative; boundary=boundary', 'line 6');
      assert.equal(lines[6], 'Content-Disposition: inline', 'line 7');
      assert.equal(lines[7], '', 'line 8');
      // TODO: match to the actual boundary
      assert.notEqual(lines[8], '--boundary', 'line 9');
      assert.equal(lines[9], 'Content-Type: text/html; charset=utf-8', 'line 10');
      assert.equal(lines[10], 'Content-Transfer-Encoding: Base64', 'line 11');
      assert.equal(lines[11], 'Content-Disposition: inline', 'line 12');
      assert.equal(lines[12], '', 'line 13');
      assert.equal(lines[13], 'VGhpcyBpcyB0aGUgYm9keQ==', 'line 14');
      assert.equal(lines[14], '', 'line 15');
      // TODO: match to the actual boundary
      assert.notEqual(lines[15], '--boundary', 'line 16');
      assert.equal(lines[16], 'Content-Type: text/plain; charset=utf-8', 'line 17');
      assert.equal(lines[17], 'Content-Disposition: inline', 'line 18');
      assert.equal(lines[18], '', 'line 19');
      assert.equal(lines[19], 'This is the plain text', 'line 20');
      assert.notEqual(lines[20], '--boundary ', 'line 21');
      assert.equal(lines[21], 'More plain text', 'line 23');
      assert.equal(lines[22], '', 'line 24');
      // TODO: match to the actual boundary
      assert.notEqual(lines[23], '--boundary--', 'line 25');
    });
  });

  await t.test('with single to address in array', t => {
    return sendmail({
      from: 'from@example.com',
      to: [
        'to@example.com',
      ],
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
      plaintext: 'This is the plain text\n--boundary\nMore plain text',
    })
    .then(() => {
      assert.equal(spawnArguments.length, 2, 'arguments length');
      assert.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      assert.deepStrictEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 24, 'Message body is 24 lines');
      assert.equal(lines[0], 'To: to@example.com', 'line 1');
      assert.equal(lines[1], 'From: from@example.com', 'line 2');
      assert.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      assert.equal(lines[3], 'Subject: Test subject', 'line 4');
      assert.equal(lines[4], 'Mime-Version: 1.0', 'line 5');
    });
  });

  await t.test('with multiple to addresses', t => {
    return sendmail({
      from: 'from@example.com',
      to: [
        'to1@example.com',
        'to2@example.com',
      ],
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
      plaintext: 'This is the plain text\n--boundary\nMore plain text',
    })
    .then(() => {
      assert.equal(spawnArguments.length, 2, 'arguments length');
      assert.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      assert.deepStrictEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 25, 'Message body is 25 lines');
      assert.equal(lines[0], 'To: to1@example.com,', 'line 1');
      assert.equal(lines[1], ' to2@example.com', 'line 2');
      assert.equal(lines[2], 'From: from@example.com', 'line 3');
      assert.equal(lines[3], 'Reply-To: from@example.com', 'line 4');
      assert.equal(lines[4], 'Subject: Test subject', 'line 5');
      assert.equal(lines[5], 'Mime-Version: 1.0', 'line 6');
    });
  });

  await t.test('with multiple to addresses', t => {
    return sendmail({
      from: 'from@example.com',
      to: [
        'to1@example.com',
        'to2@example.com',
        'to3@example.com',
      ],
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
      plaintext: 'This is the plain text\n--boundary\nMore plain text',
    })
    .then(() => {
      assert.equal(spawnArguments.length, 2, 'arguments length');
      assert.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      assert.deepStrictEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 26, 'Message body is 26 lines');
      assert.equal(lines[0], 'To: to1@example.com,', 'line 1');
      assert.equal(lines[1], ' to2@example.com,', 'line 2');
      assert.equal(lines[2], ' to3@example.com', 'line 3');
      assert.equal(lines[3], 'From: from@example.com', 'line 4');
    });
  });

  await t.test('with invalid to address', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to2',
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
      plaintext: 'This is the plain text\n--boundary\nMore plain text',
    })
    .then(() => {
      assert.fail('should not resolve');
    })
    .catch(err => {
      assert.deepEqual(err, new Error('Invalid to address'), 'Invalid to');
    });
  });

  await t.test('with multiple to addresses, one invalid', t => {
    return sendmail({
      from: 'from@example.com',
      to: [
        'to1@example.com',
        'to2',
      ],
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
      plaintext: 'This is the plain text\n--boundary\nMore plain text',
    })
    .then(() => {
      assert.fail('should not resolve');
    })
    .catch(err => {
      assert.deepEqual(err, new Error('Invalid to address'), 'Invalid to');
    });
  });

  await t.test('with single CC', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      cc: 'cc@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 8, 'Message body is 8 lines');
      assert.equal(lines[1], 'CC: cc@example.com', 'line 2');
    });
  });

  await t.test('with single CC in array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      cc: ['cc@example.com'],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 8, 'Message body is 8 lines');
      assert.equal(lines[1], 'CC: cc@example.com', 'line 2');
    });
  });

  await t.test('with empty CC array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      cc: [],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 7, 'Message body is 7 lines');
      assert.equal(lines[1], 'From: from@example.com', 'line 2');
    });
  });

  await t.test('with multiple CC array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      cc: ['cc1@example.com', 'cc2@example.com'],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 9, 'Message body is 9 lines');
      assert.equal(lines[1], 'CC: cc1@example.com,', 'line 2');
      assert.equal(lines[2], ' cc2@example.com', 'line 3');
      assert.equal(lines[3], 'From: from@example.com', 'line 4');
    });
  });

  await t.test('with multiple CC array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      cc: ['cc1@example.com', 'cc2@example.com', 'cc3@example.com'],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 10, 'Message body is 10 lines');
      assert.equal(lines[1], 'CC: cc1@example.com,', 'line 2');
      assert.equal(lines[2], ' cc2@example.com,', 'line 3');
      assert.equal(lines[3], ' cc3@example.com', 'line 4');
      assert.equal(lines[4], 'From: from@example.com', 'line 5');
    });
  });

  await t.test('with single BCC', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      bcc: 'bcc@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 8, 'Message body is 8 lines');
      assert.equal(lines[1], 'BCC: bcc@example.com', 'line 2');
    });
  });

  await t.test('with single BCC in array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      bcc: ['bcc@example.com'],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 8, 'Message body is 8 lines');
      assert.equal(lines[1], 'BCC: bcc@example.com', 'line 2');
    });
  });

  await t.test('with empty BCC array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      bcc: [],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 7, 'Message body is 7 lines');
      assert.equal(lines[1], 'From: from@example.com', 'line 2');
    });
  });

  await t.test('with multiple BCC array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      bcc: ['bcc1@example.com', 'bcc2@example.com'],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 9, 'Message body is 9 lines');
      assert.equal(lines[1], 'BCC: bcc1@example.com,', 'line 2');
      assert.equal(lines[2], ' bcc2@example.com', 'line 3');
      assert.equal(lines[3], 'From: from@example.com', 'line 4');
    });
  });

  await t.test('with multiple BCC array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      bcc: ['bcc1@example.com', 'bcc2@example.com', 'bcc3@example.com'],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      assert.equal(lines.length, 10, 'Message body is 10 lines');
      assert.equal(lines[1], 'BCC: bcc1@example.com,', 'line 2');
      assert.equal(lines[2], ' bcc2@example.com,', 'line 3');
      assert.equal(lines[3], ' bcc3@example.com', 'line 4');
      assert.equal(lines[4], 'From: from@example.com', 'line 5');
    });
  });

  await t.test('sendmail error exit', t => {
    sendmailExitCode = 1;
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .catch(err => {
      assert.deepEqual(err, new Error('sendmail exited with code: 1'), 'exit code');
    });
  });

  await t.test('invalid from address', t => {
    sendmailExitCode = 0;
    return sendmail({
      from: 'from',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .catch(err => {
      assert.deepEqual(err, new Error('Invalid from address'), 'error');
    });
  });

  await t.test('invalid envelopeFrom address', t => {
    sendmailExitCode = 0;
    return sendmail({
      from: 'from@example.com',
      envelopeFrom: 'from',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .catch(err => {
      assert.deepEqual(err, new Error('Invalid envelopeFrom address'), 'error');
    });
  });

  await t.test('sendmail path', t => {
    sendmailExitCode = 0;
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      path: '/usr/bin/sendmail',
    })
    .then(() => {
      assert.equal(spawnArguments.length, 2, 'arguments length');
      assert.equal(spawnArguments[0], '/usr/bin/sendmail', 'sendmail path');
    });
  });

  await t.test('spawn  spawnError', t => {
    spawnError = new Error('Something went wrong');
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      path: '/usr/bin/sendmail',
    })
    .then(() => {
      assert.fail('should not resolve');
    })
    .catch(err => {
      assert.deepEqual(err, new Error('Something went wrong'), 'error');
    });
  });

  await t.test('spawn  spawnThrow', t => {
    spawnError = undefined;
    spawnThrow = new Error('Spawn throw error');
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      path: '/usr/bin/sendmail',
    })
    .then(() => {
      assert.fail('should not resolve');
    })
    .catch(err => {
      assert.deepEqual(err, new Error('Spawn throw error'), 'error');
    });
  });
});
