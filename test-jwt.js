const jwt = require('jsonwebtoken');

const token = jwt.sign({ foo: 'bar' }, 'secret');
console.log("Token:", token);

try {
  jwt.verify(token, undefined);
  console.log("Verified with undefined!");
} catch (e) {
  console.log("Error verifying with undefined:", e.message);
}

try {
  jwt.verify(token, "undefined");
  console.log("Verified with string undefined!");
} catch (e) {
  console.log("Error verifying with string undefined:", e.message);
}

try {
  const token2 = jwt.sign({ foo: 'bar' }, undefined);
  console.log("Signed with undefined!", token2);
  jwt.verify(token2, undefined);
  console.log("Verified token2 with undefined!");
} catch (e) {
  console.log("Error signing with undefined:", e.message);
}
