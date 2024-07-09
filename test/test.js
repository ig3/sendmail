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
          t.fail('Unmocked event handler');
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

const t = require('tape');

const sendmail = require('../index.js');

t.test('mandatory options', t => {
  t.test('all required options', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    });
  });
  t.test('missing from option', t => {
    return sendmail({
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .catch(err => {
      t.deepEqual(err, new Error('Missing from address'), 'Missing from');
    });
  });
  t.test('missing to option', t => {
    return sendmail({
      from: 'from@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .catch(err => {
      t.deepEqual(err, new Error('Missing to address'), 'Missing to');
    });
  });
  t.test('missing subject option', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      body: 'This is the body',
    })
    .catch(err => {
      t.deepEqual(err, new Error('Missing subject'), 'Missing subject');
    });
  });
  t.test('Missing body option', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
    })
    .catch(err => {
      t.deepEqual(err, new Error('Missing body'), 'Missing body');
    });
  });
});

t.test('sendmail command', t => {
  t.test('basic plain text', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      t.equal(spawnArguments.length, 2, 'arguments length');
      t.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      t.deepEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      t.equal(lines[0], 'To: to@example.com', 'line 1');
      t.equal(lines[1], 'From: from@example.com', 'line 2');
      t.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      t.equal(lines[3], 'Subject: Test subject', 'line 4');
      t.equal(lines[4], '', 'line 5');
      t.equal(lines[5], 'This is the body', 'line 6');
      t.equal(lines[6], '', 'line 7');
    });
  });

  t.test('with envelopeFrom', t => {
    return sendmail({
      from: 'from@example.com',
      envelopeFrom: 'test@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      t.equal(spawnArguments.length, 2, 'arguments length');
      t.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      t.deepEqual(spawnArguments[1], ['-i', '-t', '-f', 'test@example.com'], 'args');
      const lines = endMessage.split('\n');
      t.equal(lines[0], 'To: to@example.com', 'line 1');
      t.equal(lines[1], 'From: from@example.com', 'line 2');
      t.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      t.equal(lines[3], 'Subject: Test subject', 'line 4');
      t.equal(lines[4], '', 'line 5');
      t.equal(lines[5], 'This is the body', 'line 6');
      t.equal(lines[6], '', 'line 7');
    });
  });

  t.test('with bodyType html', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
    })
    .then(() => {
      t.equal(spawnArguments.length, 2, 'arguments length');
      t.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      t.deepEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      t.equal(lines.length, 16, 'Message body is 16 lines');
      t.equal(lines[0], 'To: to@example.com', 'line 1');
      t.equal(lines[1], 'From: from@example.com', 'line 2');
      t.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      t.equal(lines[3], 'Subject: Test subject', 'line 4');
      t.equal(lines[4], 'Mime-Version: 1.0', 'line 5');
      t.equal(lines[5], 'Content-Type: multipart/alternative; boundary=boundary', 'line 6');
      t.equal(lines[6], 'Content-Disposition: inline', 'line 7');
      t.equal(lines[7], '', 'line 8');
      t.equal(lines[8], '--boundary', 'line 9');
      t.equal(lines[9], 'Content-Type: text/html; charset=utf-8', 'line 10');
      t.equal(lines[10], 'Content-Transfer-Encoding: Base64', 'line 11');
      t.equal(lines[11], 'Content-Disposition: inline', 'line 12');
      t.equal(lines[12], '', 'line 13');
      t.equal(lines[13], 'VGhpcyBpcyB0aGUgYm9keQ==', 'line 14');
      t.equal(lines[14], '', 'line 15');
      t.equal(lines[15], '--boundary--', 'line 16');
    });
  });

  t.test('with bodyType html and plaintext', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
      plaintext: 'This is the plain text',
    })
    .then(() => {
      t.equal(spawnArguments.length, 2, 'arguments length');
      t.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      t.deepEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      t.equal(lines.length, 22, 'Message body is 22 lines');
      t.equal(lines[0], 'To: to@example.com', 'line 1');
      t.equal(lines[1], 'From: from@example.com', 'line 2');
      t.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      t.equal(lines[3], 'Subject: Test subject', 'line 4');
      t.equal(lines[4], 'Mime-Version: 1.0', 'line 5');
      t.equal(lines[5], 'Content-Type: multipart/alternative; boundary=boundary', 'line 6');
      t.equal(lines[6], 'Content-Disposition: inline', 'line 7');
      t.equal(lines[7], '', 'line 8');
      t.equal(lines[8], '--boundary', 'line 9');
      t.equal(lines[9], 'Content-Type: text/html; charset=utf-8', 'line 10');
      t.equal(lines[10], 'Content-Transfer-Encoding: Base64', 'line 11');
      t.equal(lines[11], 'Content-Disposition: inline', 'line 12');
      t.equal(lines[12], '', 'line 13');
      t.equal(lines[13], 'VGhpcyBpcyB0aGUgYm9keQ==', 'line 14');
      t.equal(lines[14], '', 'line 15');
      t.equal(lines[15], '--boundary', 'line 16');
      t.equal(lines[16], 'Content-Type: text/plain; charset=utf-8', 'line 17');
      t.equal(lines[17], 'Content-Disposition: inline', 'line 18');
      t.equal(lines[18], '', 'line 19');
      t.equal(lines[19], 'This is the plain text', 'line 20');
      t.equal(lines[20], '', 'line 21');
      t.equal(lines[21], '--boundary--', 'line 22');
    });
  });

  t.test('with "--boundary " in plaintext', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
      plaintext: 'This is the plain text\n--boundary \nMore plain text',
    })
    .then(() => {
      t.equal(spawnArguments.length, 2, 'arguments length');
      t.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      t.deepEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      t.equal(lines.length, 24, 'Message body is 24 lines');
      t.equal(lines[0], 'To: to@example.com', 'line 1');
      t.equal(lines[1], 'From: from@example.com', 'line 2');
      t.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      t.equal(lines[3], 'Subject: Test subject', 'line 4');
      t.equal(lines[4], 'Mime-Version: 1.0', 'line 5');
      t.equal(lines[5], 'Content-Type: multipart/alternative; boundary=boundary', 'line 6');
      t.equal(lines[6], 'Content-Disposition: inline', 'line 7');
      t.equal(lines[7], '', 'line 8');
      t.equal(lines[8], '--boundary', 'line 9');
      t.equal(lines[9], 'Content-Type: text/html; charset=utf-8', 'line 10');
      t.equal(lines[10], 'Content-Transfer-Encoding: Base64', 'line 11');
      t.equal(lines[11], 'Content-Disposition: inline', 'line 12');
      t.equal(lines[12], '', 'line 13');
      t.equal(lines[13], 'VGhpcyBpcyB0aGUgYm9keQ==', 'line 14');
      t.equal(lines[14], '', 'line 15');
      t.equal(lines[15], '--boundary', 'line 16');
      t.equal(lines[16], 'Content-Type: text/plain; charset=utf-8', 'line 17');
      t.equal(lines[17], 'Content-Disposition: inline', 'line 18');
      t.equal(lines[18], '', 'line 19');
      t.equal(lines[19], 'This is the plain text', 'line 20');
      t.equal(lines[20], '--boundary ', 'line 21');
      t.equal(lines[21], 'More plain text', 'line 23');
      t.equal(lines[22], '', 'line 24');
      t.equal(lines[23], '--boundary--', 'line 25');
    });
  });

  t.test('with "--boundary" in plaintext', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
      plaintext: 'This is the plain text\n--boundary\nMore plain text',
    })
    .then(() => {
      t.equal(spawnArguments.length, 2, 'arguments length');
      t.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      t.deepEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      t.equal(lines.length, 24, 'Message body is 24 lines');
      t.equal(lines[0], 'To: to@example.com', 'line 1');
      t.equal(lines[1], 'From: from@example.com', 'line 2');
      t.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      t.equal(lines[3], 'Subject: Test subject', 'line 4');
      t.equal(lines[4], 'Mime-Version: 1.0', 'line 5');
      // TODO: test against re and extract the actual bondary
      t.notEqual(lines[5], 'Content-Type: multipart/alternative; boundary=boundary', 'line 6');
      t.equal(lines[6], 'Content-Disposition: inline', 'line 7');
      t.equal(lines[7], '', 'line 8');
      // TODO: match to the actual boundary
      t.notEqual(lines[8], '--boundary', 'line 9');
      t.equal(lines[9], 'Content-Type: text/html; charset=utf-8', 'line 10');
      t.equal(lines[10], 'Content-Transfer-Encoding: Base64', 'line 11');
      t.equal(lines[11], 'Content-Disposition: inline', 'line 12');
      t.equal(lines[12], '', 'line 13');
      t.equal(lines[13], 'VGhpcyBpcyB0aGUgYm9keQ==', 'line 14');
      t.equal(lines[14], '', 'line 15');
      // TODO: match to the actual boundary
      t.notEqual(lines[15], '--boundary', 'line 16');
      t.equal(lines[16], 'Content-Type: text/plain; charset=utf-8', 'line 17');
      t.equal(lines[17], 'Content-Disposition: inline', 'line 18');
      t.equal(lines[18], '', 'line 19');
      t.equal(lines[19], 'This is the plain text', 'line 20');
      t.notEqual(lines[20], '--boundary ', 'line 21');
      t.equal(lines[21], 'More plain text', 'line 23');
      t.equal(lines[22], '', 'line 24');
      // TODO: match to the actual boundary
      t.notEqual(lines[23], '--boundary--', 'line 25');
    });
  });

  t.test('with single to address in array', t => {
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
      t.equal(spawnArguments.length, 2, 'arguments length');
      t.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      t.deepEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      t.equal(lines.length, 24, 'Message body is 24 lines');
      t.equal(lines[0], 'To: to@example.com', 'line 1');
      t.equal(lines[1], 'From: from@example.com', 'line 2');
      t.equal(lines[2], 'Reply-To: from@example.com', 'line 3');
      t.equal(lines[3], 'Subject: Test subject', 'line 4');
      t.equal(lines[4], 'Mime-Version: 1.0', 'line 5');
    });
  });

  t.test('with multiple to addresses', t => {
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
      t.equal(spawnArguments.length, 2, 'arguments length');
      t.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      t.deepEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      t.equal(lines.length, 25, 'Message body is 25 lines');
      t.equal(lines[0], 'To: to1@example.com,', 'line 1');
      t.equal(lines[1], ' to2@example.com', 'line 2');
      t.equal(lines[2], 'From: from@example.com', 'line 3');
      t.equal(lines[3], 'Reply-To: from@example.com', 'line 4');
      t.equal(lines[4], 'Subject: Test subject', 'line 5');
      t.equal(lines[5], 'Mime-Version: 1.0', 'line 6');
    });
  });

  t.test('with multiple to addresses', t => {
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
      t.equal(spawnArguments.length, 2, 'arguments length');
      t.equal(spawnArguments[0], 'sendmail', 'sendmail path');
      t.deepEqual(spawnArguments[1], ['-i', '-t'], 'args');
      const lines = endMessage.split('\n');
      t.equal(lines.length, 26, 'Message body is 26 lines');
      t.equal(lines[0], 'To: to1@example.com,', 'line 1');
      t.equal(lines[1], ' to2@example.com,', 'line 2');
      t.equal(lines[2], ' to3@example.com', 'line 3');
      t.equal(lines[3], 'From: from@example.com', 'line 4');
    });
  });

  t.test('with invalid to address', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to2',
      subject: 'Test subject',
      body: 'This is the body',
      bodyType: 'html',
      plaintext: 'This is the plain text\n--boundary\nMore plain text',
    })
    .then(() => {
      t.fail('should not resolve');
    })
    .catch(err => {
      t.deepEqual(err, new Error('Invalid to address'), 'Invalid to');
    });
  });

  t.test('with multiple to addresses, one invalid', t => {
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
      t.fail('should not resolve');
    })
    .catch(err => {
      t.deepEqual(err, new Error('Invalid to address'), 'Invalid to');
    });
  });

  t.test('with single CC', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      cc: 'cc@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      t.equal(lines.length, 8, 'Message body is 8 lines');
      t.equal(lines[1], 'CC: cc@example.com', 'line 2');
    });
  });

  t.test('with single CC in array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      cc: ['cc@example.com'],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      t.equal(lines.length, 8, 'Message body is 8 lines');
      t.equal(lines[1], 'CC: cc@example.com', 'line 2');
    });
  });

  t.test('with empty CC array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      cc: [],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      t.equal(lines.length, 7, 'Message body is 7 lines');
      t.equal(lines[1], 'From: from@example.com', 'line 2');
    });
  });

  t.test('with multiple CC array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      cc: ['cc1@example.com', 'cc2@example.com'],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      t.equal(lines.length, 9, 'Message body is 9 lines');
      t.equal(lines[1], 'CC: cc1@example.com,', 'line 2');
      t.equal(lines[2], ' cc2@example.com', 'line 3');
      t.equal(lines[3], 'From: from@example.com', 'line 4');
    });
  });

  t.test('with multiple CC array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      cc: ['cc1@example.com', 'cc2@example.com', 'cc3@example.com'],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      t.equal(lines.length, 10, 'Message body is 10 lines');
      t.equal(lines[1], 'CC: cc1@example.com,', 'line 2');
      t.equal(lines[2], ' cc2@example.com,', 'line 3');
      t.equal(lines[3], ' cc3@example.com', 'line 4');
      t.equal(lines[4], 'From: from@example.com', 'line 5');
    });
  });

  t.test('with single BCC', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      bcc: 'bcc@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      t.equal(lines.length, 8, 'Message body is 8 lines');
      t.equal(lines[1], 'BCC: bcc@example.com', 'line 2');
    });
  });

  t.test('with single BCC in array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      bcc: ['bcc@example.com'],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      t.equal(lines.length, 8, 'Message body is 8 lines');
      t.equal(lines[1], 'BCC: bcc@example.com', 'line 2');
    });
  });

  t.test('with empty BCC array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      bcc: [],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      t.equal(lines.length, 7, 'Message body is 7 lines');
      t.equal(lines[1], 'From: from@example.com', 'line 2');
    });
  });

  t.test('with multiple BCC array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      bcc: ['bcc1@example.com', 'bcc2@example.com'],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      t.equal(lines.length, 9, 'Message body is 9 lines');
      t.equal(lines[1], 'BCC: bcc1@example.com,', 'line 2');
      t.equal(lines[2], ' bcc2@example.com', 'line 3');
      t.equal(lines[3], 'From: from@example.com', 'line 4');
    });
  });

  t.test('with multiple BCC array', t => {
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      bcc: ['bcc1@example.com', 'bcc2@example.com', 'bcc3@example.com'],
      subject: 'Test subject',
      body: 'This is the body',
    })
    .then(() => {
      const lines = endMessage.split('\n');
      t.equal(lines.length, 10, 'Message body is 10 lines');
      t.equal(lines[1], 'BCC: bcc1@example.com,', 'line 2');
      t.equal(lines[2], ' bcc2@example.com,', 'line 3');
      t.equal(lines[3], ' bcc3@example.com', 'line 4');
      t.equal(lines[4], 'From: from@example.com', 'line 5');
    });
  });

  t.test('sendmail error exit', t => {
    sendmailExitCode = 1;
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .catch(err => {
      t.deepEqual(err, new Error('sendmail exited with code: 1'), 'exit code');
    });
  });

  t.test('invalid from address', t => {
    sendmailExitCode = 0;
    return sendmail({
      from: 'from',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .catch(err => {
      t.deepEqual(err, new Error('Invalid from address'), 'error');
    });
  });

  t.test('invalid envelopeFrom address', t => {
    sendmailExitCode = 0;
    return sendmail({
      from: 'from@example.com',
      envelopeFrom: 'from',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
    })
    .catch(err => {
      t.deepEqual(err, new Error('Invalid envelopeFrom address'), 'error');
    });
  });

  t.test('sendmail path', t => {
    sendmailExitCode = 0;
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      path: '/usr/bin/sendmail',
    })
    .then(() => {
      t.equal(spawnArguments.length, 2, 'arguments length');
      t.equal(spawnArguments[0], '/usr/bin/sendmail', 'sendmail path');
    });
  });

  t.test('spawn  spawnError', t => {
    spawnError = new Error('Something went wrong');
    return sendmail({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test subject',
      body: 'This is the body',
      path: '/usr/bin/sendmail',
    })
    .then(() => {
      t.fail('should not resolve');
    })
    .catch(err => {
      t.deepEqual(err, new Error('Something went wrong'), 'error');
    });
  });

  t.test('spawn  spawnThrow', t => {
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
      t.fail('should not resolve');
    })
    .catch(err => {
      t.deepEqual(err, new Error('Spawn throw error'), 'error');
    });
  });
});
