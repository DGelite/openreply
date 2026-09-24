const mariadb = require('mariadb');
try {
  const pool = mariadb.createPool('mariadb://root:pass@localhost:3306/db?connectionLimit=5&acquireTimeout=30000');
  console.log('Pool created successfully');
} catch(e) {
  console.error(e);
}
