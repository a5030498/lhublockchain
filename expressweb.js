var sql = require('mssql');
var config = {
  server: 'lhweb.kli.com.tw',  //update me
  user: 'sa', //update me
  password: '1qaz@WSX',  //update me
  database: 'blockchain'  //update me
};

const conn = new sql.ConnectionPool(config);
const schedule = require('node-schedule');
var express = require('express');
var bodyParser = require('body-parser');
var cmd = require('node-cmd');

const session = require('express-session');
// const { response } = require('express');
var app = express();
//設置session相關設定
app.use(express.static('static'));
app.use(bodyParser.json()); // support json encoded bodies

app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.use(session({
  secret: 'abcdefghijklmn',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60 * 1000 * 100 } //100分鐘到期
}));

app.get('/', function (req, res) {
  if (!(req.session.time)) req.session.time = 1; else req.session.time++;
  res.send('Hello World Express! ' + req.session.time);
});
app.get('/testCMD', function (req, res) {
  const syncData = cmd.runSync('cat package.json');
  console.log(`length: ${syncData.data.length}`);
  //console.log(`${syncData.data}`);

  var rs1 = `${syncData.data}`.split(',');
  console.log(rs1.length);
  for (var i = 0; i < rs1.length; i++) {
    //console.log('List-----'+rs1[i]);
    rs1[i] = '<br>==== ' + rs1[i];
  }
  console.log('Date()-----' + Date.now());
  cmd.runSync('touch test' + Date.now());
  res.send('testCMD Result---' + rs1);
});

app.listen(80, function () {
  console.log('Example app listening on port 80!');
});

app.set('view engine', 'ejs');


//-----------------------------------------------------------------------------------------------------------------------------------
app.get('/login', function (req, res) {
  var acct = req.query.acct;
  var pwd = req.query.pwd;

  console.log('in--' + req.session.status);
  console.log('' + req.session.msg);

  if (!acct || !pwd) {

    req.session.msg = '請輸入帳號與密碼';
    res.render('login', {
      title: '登入',
      req: req
    });

  } else {

    conn.connect().then(function () {
      var sqlQuery = "select * from member where memberno='" + acct + "'";
      var reqsql = new sql.Request(conn);
      reqsql.query(sqlQuery).then(function (result) {
        //console.log(result.recordset);
        //console.log(result.recordset.length);

        //error
        if (result.recordset.length == 0) {

          req.session.status = 'loginfail';
          req.session.msg = '無此帳號';

          res.render('login', {
            title: '登入',
            req: req
          });

          conn.close();

        } else {
          console.log('getRS');
          console.log(result.recordset[0]);
          sqlQuery = "select * from member where memberno='" + acct + "' and pwd='" + pwd + "'";
          console.log(sqlQuery);
          reqsql.query(sqlQuery).then(function (result) {

            if (result.recordset.length == 0) {
              console.log('密碼錯誤');
              req.session.status = 'loginfail';
              req.session.msg = '密碼錯誤';

              res.render('login', {
                title: '登入',
                req: req
              });

            } else {
              if (result.recordset[0].authority == 0) {
                console.log('停權');
                req.session.status = 'loginfail';
                req.session.msg = '此帳號已停權';

                res.render('login', {
                  title: '登入',
                  req: req
                });

              } else {

                console.log('login');
                console.log(result.recordset)
                req.session.memberno = result.recordset[0].memberno;
                req.session.username = result.recordset[0].username;
                req.session.authority = result.recordset[0].authority;
                req.session.point = result.recordset[0].point;
                req.session.status = 'loginsuccess';

                redirectPage(res, req, 'backStageIndex');
              }
            }

            conn.close();

          }).catch(function (err) {
            console.log('err3');
            console.log(err);
            conn.close();

          });

        }//else

      }).catch(function (err) {
        console.log('err2');
        console.log(err);

      });
    });
  }//else

});//end

app.get('/logout', function (req, res) {

  req.session.status = 'logout';
  redirectPage(res, req, 'login');

});

app.get('/backStageIndex', function (req, res) {

  console.log(req.session.status);

  if (req.session.status != 'loginsuccess') {
    console.log('in');
    req.session.status = 'logout';

    redirectPage(res, req, 'login');

  } else {

    res.render('backStageIndex', {
      title: '功能列表',
      req: req
    });
  }

});

app.get('/activityMaintain', function (req, res) {
  validSession(req, res);
  conn.connect().then(function () {
    var sqlQuery = "select * from activity where activitydate > GETDATE()";
    var reqsql = new sql.Request(conn);
    reqsql.query(sqlQuery).then(function (result) {
      //console.log(result.recordset);
      //console.log(result.recordset.length);

      res.render('activityMaintain', {
        title: '活動維護',
        users: ['活動維護', '商品維護', '廠商維護', '會員維護'],
        sqlRS: result.recordset,
        req: req
      });

    }).catch(function (err) {
      console.log('err2');
      console.log(err);

    });
  }).catch(function (err) {
    console.log('err2');
    console.log(err);

  });
});

app.get('/activityMaintainDetail/:no', function (req, res) {

  console.log(req.session.status);
  validSession(req, res);

  var no = req.params.no;
  //var id = req.query.id;

  var type = no.split('-')[0];
  var id = no.split('-')[1];
  console.log('type-----' + type);
  console.log('no-----' + no);

  if (type == 'delete') {

    console.log('delete id=' + id);

    //res.send("delete OK!")

    conn.connect().then(function (err) {
      const ps = new sql.PreparedStatement(conn)
      ps.input('id', sql.Int)

      ps.prepare('delete from activity where id=@id', err => {
        // ... error checks
        ps.execute({ id: id }, (err, result) => {
          // ... error checks
          // release the connection after queries are executed
          ps.unprepare(err => {
            // ... error checks
            if (!err) {

              redirectPage(res, req, 'activityMaintain');

            }
          })
        })
      })
    })
  } else if (no == 'insert') {

    console.log('insert into');
    //var id = req.query.id;
    var activityno = req.query.activityno;
    var activityname = req.query.activityname;
    var nickname = req.query.nickname;
    var location = req.query.location;
    var attendnumber = req.query.attendnumber;
    var activitydate = req.query.activitydate;
    var point = req.query.point;
    var content = req.query.content;
    var exchangecode = req.query.exchangecode;
    var status = 1;
    var activitypoint = point * parseInt(attendnumber);
    console.log(req.query);

    conn.connect().then(function (err) {
      const ps = new sql.PreparedStatement(conn)
      //ps.input('id', sql.Int)
      ps.input('activityno', sql.NVarChar)
      ps.input('activityname', sql.NVarChar)
      ps.input('nickname', sql.NVarChar)
      ps.input('location', sql.NVarChar)
      ps.input('attendnumber', sql.NVarChar)
      ps.input('activitydate', sql.Date)
      ps.input('point', sql.Int)
      ps.input('content', sql.NVarChar)
      ps.input('exchangecode', sql.NVarChar)
      ps.input('status', sql.Char)
      ps.input('activitypoint', sql.Int)

      ps.prepare('insert into activity (activityno,activityname,nickname,location,attendnumber,activitydate,point,content,exchangecode,status,activitypoint) \
                              values(@activityno,@activityname,@nickname,@location,@attendnumber,@activitydate,@point,@content,@exchangecode,@status,@activitypoint) ', err => {
        // ... error checks ,@content,@exchangecode
        ps.execute({
          activityno: activityno, activityname: activityname, nickname: nickname, location: location, attendnumber: attendnumber, activitydate: activitydate, point: point,
          content: content, exchangecode: exchangecode, status: status, activitypoint: activitypoint
        }, (err, result) => {
          // ... error checks
          // release the connection after queries are executed
          ps.unprepare(err => {
            // ... error checks
            if (!err) {
              
              if(status==2){
              let updateMemberQuery = "update memeber set point = point-"+activitypoint+"  where authority=6"
              var request = new sql.Request(conn);
              request.query(updateMemberQuery)
              }
              conn.close();
              redirectPage(res, req, 'activityMaintain');
            }
          })
        })
      })
    })

  } else if (no == 'add') {

    conn.connect().then(function () {
      var sqlQuery = "select * from activity where activityno = '" + no + "'";
      var reqsql = new sql.Request(conn);
      reqsql.query(sqlQuery).then(function (result) {
        //console.log(sqlQuery);
        //console.log(result.recordset);

        res.render('activityMaintainDetail', {
          title: '活動維護',
          users: ['活動維護', '商品維護', '廠商維護', '會員維護'],
          sqldetail: result.recordset

        });

      }).catch(function (err) {
        //console.log('err2');
        //console.log(err);

      });
    }).catch(function (err) {
      //console.log('err2');
      //console.log(err);

    });

  } else if (type == 'save') {

    id = req.query.id;
    //console.log('intoSAV');
    //console.log('intoSAV--id--' + id);

    //var activityno = req.query.activityno;
    var activityname = req.query.activityname;
    var nickname = req.query.nickname;
    var location = req.query.location;
    var attendnumber = req.query.attendnumber;
    var activitydate = req.query.activitydate;
    var point = req.query.point;
    var content = req.query.content;
    var exchangecode = req.query.exchangecode;
    var status = req.query.status;
    console.log(req.query);

    conn.connect().then(function (err) {
      const ps = new sql.PreparedStatement(conn)
      ps.input('id', sql.Int)
      //ps.input('activityno', sql.NVarChar)
      ps.input('activityname', sql.NVarChar)
      ps.input('nickname', sql.NVarChar)
      ps.input('location', sql.NVarChar)
      ps.input('attendnumber', sql.NVarChar)
      ps.input('activitydate', sql.Date)
      ps.input('point', sql.Int)
      ps.input('content', sql.NVarChar)
      ps.input('exchangecode', sql.NVarChar)
      ps.input('status', sql.Char)

      ps.prepare('update activity set point=@point,activitydate=@activitydate ,activityname=@activityname,nickname=@nickname,\
      location=@location,attendnumber=@attendnumber,content=@content,exchangecode=@exchangecode,status=@status where id =@id', err => {
        // ... error checks
        ps.execute({
          id: id, point: point, activitydate: activitydate, activityname: activityname, nickname: nickname
          , location: location, attendnumber: attendnumber, content: content, exchangecode: exchangecode, status: status
        }, (err, result) => {
          // ... error checks
          // release the connection after queries are executed
          ps.unprepare(err => {
            // ... error checks
            if (!err) {

              //res.send("UPdate OK!")
              redirectPage(res, req, 'activityMaintain');
            }
          })
        })
      })
    })
  } else if (no != 'save') {//detail

    conn.connect().then(function () {
      var sqlQuery = "select * from activity where id = " + id;
      var reqsql = new sql.Request(conn);
      console.log(sqlQuery);
      reqsql.query(sqlQuery).then(function (result) {

        //console.log(result.recordset);

        res.render('activityMaintainDetail', {
          title: '活動維護',
          users: ['活動維護', '商品維護', '廠商維護', '會員維護'],
          sqldetail: result.recordset

        });

      }).catch(function (err) {
        console.log('query-err');
        console.log(err);

      });
    }).catch(function (err) {
      console.log('conn-err');
      console.log(err);

    });
  }

});





app.get('/itemMaintain', function (req, res) {
  console.log(req.session.status);


  validSession(req, res);

  conn.connect().then(function () {
    var sqlQuery = "select * from item ";
    var reqsql = new sql.Request(conn);
    reqsql.query(sqlQuery).then(function (result) {
      console.log(result.recordset);
      console.log(result.recordset.length);

      res.render('itemMaintain', {
        title: '商品維護',
        users: ['活動維護', '商品維護', '廠商維護', '會員維護'],
        sqlRS: result.recordset,
        req: req
      });

    }).catch(function (err) {
      console.log('err2');
      console.log(err);

    });
  }).catch(function (err) {
    console.log('err2');
    console.log(err);

  });

});

app.get('/itemMaintainDetail/:no', function (req, res) {


  console.log(req.session.status);
  validSession(req, res);

  var no = req.params.no;
  //var id = req.query.id;

  var type = no.split('-')[0];
  var id = no.split('-')[1];
  console.log('type-----' + type);
  console.log('no-----' + no);

  if (type == 'delete') {

    console.log('delete id=' + id);

    //res.send("delete OK!")

    conn.connect().then(function (err) {
      const ps = new sql.PreparedStatement(conn)
      ps.input('id', sql.Int)

      ps.prepare('delete from item where id=@id', err => {
        // ... error checks
        ps.execute({ id: id }, (err, result) => {
          // ... error checks
          // release the connection after queries are executed
          ps.unprepare(err => {
            // ... error checks
            if (!err) {

              redirectPage(res, req, 'itemMaintain');

            }
          })
        })
      })
    })
  } else if (no == 'insert') {

    console.log('insert into');
    //var id = req.query.id;
    var itemno = req.query.itemno;
    var itemname = req.query.itemname;
    var quantity = req.query.quantity;
    var amount = req.query.amount;
    var content = req.query.content;

    console.log(req.query);

    conn.connect().then(function (err) {
      let ps = new sql.PreparedStatement(conn)
      ps.input('id', sql.Int)
      ps.input('itemno', sql.NVarChar)
      ps.input('itemname', sql.NVarChar)
      ps.input('quantity', sql.NVarChar)
      ps.input('amount', sql.NVarChar)
      ps.input('content', sql.NVarChar)

      ps.prepare('insert into item (itemno,itemname,quantity,amount,content) \
                            values(@itemno,@itemname,@quantity,@amount,@content) ', err => {
        // ... error checks ,@content,@exchangecode
        ps.execute({
          itemno: itemno, itemname: itemname, quantity: quantity, amount: amount, content: content
        }, (err, result) => {
          // ... error checks
          // release the connection after queries are executed
          ps.unprepare(err => {
            // ... error checks
            if (!err) {
              let ps =new sql.PreparedStatement(conn)
              ps.input('point',sql.Int)
              ps.prepare('update member set point=point + @point where authority=6',err=>{
                let point = quantity * amount
                ps.execute({
                  point:point
                },(err,result)=>{
                  if(err){

                    console.log(err)
                  }
                  ps.unprepare(err=>{
                    if(!err){
                      redirectPage(res, req, 'itemMaintain');
                    }
                  })        
                })
              })
            }
          })
        })
      })
    })

  } else if (no == 'add') {
    console.log("111111111111")
    conn.connect().then(function () {
      var sqlQuery = "select * from item where itemno = '" + no + "'";
      console.log("2222222222222")
      var reqsql = new sql.Request(conn);
      console.log("33333333333333333")
      reqsql.query(sqlQuery).then(function (result) {
        console.log("222222222222222")
        res.render('itemMaintainDetail', {
          title: '商品維護',
          users: ['活動維護', '商品維護', '廠商維護', '會員維護'],
          sqldetail: result.recordset

        });

      }).catch(function (err) {
        //console.log('err2');
        console.log(err);

      });
    }).catch(function (err) {
      //console.log('err2');
      console.log(err);

    });

  } else if (type == 'save') {

    id = req.query.id;
    console.log('intoSAV');
    //console.log('intoSAV--id--' + id);

    var itemno = req.query.itemno;
    var itemname = req.query.itemname;
    var quantity = req.query.quantity;
    var amount = req.query.amount;
    var content = req.query.content;
    console.log(req.query);

    conn.connect().then(function (err) {
      const ps = new sql.PreparedStatement(conn)
      ps.input('id', sql.Int)
      //ps.input('itemno', sql.NVarChar)
      ps.input('itemname', sql.NVarChar)
      ps.input('quantity', sql.NVarChar)
      ps.input('amount', sql.NVarChar)
      ps.input('content', sql.NVarChar)

      ps.prepare('update item set itemname=@itemname,quantity=@quantity ,amount=@amount,content=@content where id =@id', err => {
        // ... error checks
        ps.execute({
          id: id, itemname: itemname, quantity: quantity, amount: amount, content: content
        }, (err, result) => {
          // ... error checks
          // release the connection after queries are executed
          ps.unprepare(err => {
            // ... error checks
            if (!err) {

              //res.send("UPdate OK!")
              redirectPage(res, req, 'itemMaintain');
            }
          })
        })
      })
    })
  } else if (no != 'save') {//detail

    conn.connect().then(function () {
      var sqlQuery = "select * from item where id = " + id;
      var reqsql = new sql.Request(conn);
      console.log(sqlQuery);
      reqsql.query(sqlQuery).then(function (result) {

        //console.log(result.recordset);

        res.render('itemMaintainDetail', {
          title: '活動維護',
          users: ['活動維護', '商品維護', '廠商維護', '會員維護'],
          sqldetail: result.recordset

        });

      }).catch(function (err) {
        console.log('query-err');
        console.log(err);

      });
    }).catch(function (err) {
      console.log('conn-err');
      console.log(err);

    });
  }

});

app.get('/vendorMaintain', function (req, res) {
  validSession(req, res);
  conn.connect().then(function () {
    var sqlQuery = "select * from vendor ";
    var reqsql = new sql.Request(conn);
    reqsql.query(sqlQuery).then(function (result) {
      //console.log(result.recordset);
      //console.log(result.recordset.length);

      res.render('vendorMaintain', {
        title: '廠商維護',
        users: ['活動維護', '商品維護', '廠商維護', '會員維護'],
        sqlRS: result.recordset,
        req: req
      });

    }).catch(function (err) {
      console.log('err2');
      console.log(err);

    });
  }).catch(function (err) {
    console.log('err2');
    console.log(err);

  });
});

app.get('/vendorMaintainDetail/:no', function (req, res) {


  console.log(req.session.status);
  validSession(req, res);

  var no = req.params.no;
  //var id = req.query.id;

  var type = no.split('-')[0];
  var id = no.split('-')[1];
  console.log('type-----' + type);
  console.log('no-----' + no);

  if (type == 'delete') {

    console.log('delete id=' + id);

    //res.send("delete OK!")

    conn.connect().then(function (err) {
      const ps = new sql.PreparedStatement(conn)
      ps.input('id', sql.Int)

      ps.prepare('delete from vendor where id=@id', err => {
        // ... error checks
        ps.execute({ id: id }, (err, result) => {
          // ... error checks
          // release the connection after queries are executed
          ps.unprepare(err => {
            // ... error checks
            if (!err) {

              redirectPage(res, req, 'vendorMaintain');

            }
          })
        })
      })
    })
  } else if (no == 'insert') {

    console.log('insert into');
    //var id = req.query.id;
    var vendorno = req.query.vendorno;
    var pwd = req.query.pwd;
    var name = req.query.name;
    var cellphone = req.query.cellphone;
    var address = req.query.address;
    var mail = req.query.mail;
    var joindate = req.query.joindate;
    var dnrecord = req.query.dnrecord;

    console.log(req.query);

    conn.connect().then(function (err) {
      const ps = new sql.PreparedStatement(conn)
      //ps.input('id', sql.Int)
      ps.input('vendorno', sql.NVarChar)
      ps.input('pwd', sql.NVarChar)
      ps.input('name', sql.NVarChar)
      ps.input('cellphone', sql.NVarChar)
      ps.input('address', sql.NVarChar)
      ps.input('mail', sql.NVarChar)
      ps.input('joindate', sql.Date)
      ps.input('dnrecord', sql.NVarChar)

      ps.prepare('insert into vendor (vendorno,pwd,name,cellphone,address,mail,joindate,dnrecord) \
                            values(@vendorno,@pwd,@name,@cellphone,@address,@mail,@joindate,@dnrecord ) ', err => {
        // ... error checks ,@content,@exchangecode
        ps.execute({
          vendorno: vendorno, pwd: pwd, name: name, cellphone: cellphone, address: address, mail: mail, joindate: joindate,
          dnrecord: dnrecord
        }, (err, result) => {
          // ... error checks
          // release the connection after queries are executed
          ps.unprepare(err => {
            // ... error checks
            if (!err) {
              redirectPage(res, req, 'vendorMaintain');

            }
          })
        })
      })
    })

  } else if (no == 'add') {

    conn.connect().then(function () {
      var sqlQuery = "select * from vendor where vendorno = '" + no + "'";;
      var reqsql = new sql.Request(conn);
      reqsql.query(sqlQuery).then(function (result) {
        //console.log(sqlQuery);
        //console.log(result.recordset);

        res.render('vendorMaintainDetail', {
          title: '商品維護',
          users: ['活動維護', '商品維護', '廠商維護', '會員維護'],
          sqldetail: result.recordset

        });

      }).catch(function (err) {
        //console.log('err2');
        //console.log(err);

      });
    }).catch(function (err) {
      //console.log('err2');
      //console.log(err);

    });

  } else if (type == 'save') {

    id = req.query.id;
    console.log('intoSAV');
    //console.log('intoSAV--id--' + id);

    //var vendorno = req.query.vendorno;
    var pwd = req.query.pwd;
    var name = req.query.name;
    var cellphone = req.query.cellphone;
    var address = req.query.address;
    var mail = req.query.mail;
    var joindate = req.query.joindate;
    var dnrecord = req.query.dnrecord;


    console.log(req.query);

    conn.connect().then(function (err) {
      const ps = new sql.PreparedStatement(conn)
      ps.input('id', sql.Int)
      //ps.input('vendorno', sql.NVarChar)
      ps.input('pwd', sql.NVarChar)
      ps.input('name', sql.NVarChar)
      ps.input('cellphone', sql.NVarChar)
      ps.input('address', sql.NVarChar)
      ps.input('mail', sql.NVarChar)
      ps.input('joindate', sql.Date)
      ps.input('dnrecord', sql.NVarChar)

      ps.prepare('update vendor set pwd=@pwd,name=@name ,cellphone=@cellphone,address=@address\
      ,mail=@mail,joindate=@joindate,dnrecord=@dnrecord where id =@id', err => {
        // ... error checks
        ps.execute({
          id: id, pwd: pwd, name: name, cellphone: cellphone, address: address, mail: mail, joindate: joindate,
          dnrecord: dnrecord
        }, (err, result) => {
          // ... error checks
          // release the connection after queries are executed
          ps.unprepare(err => {
            // ... error checks
            if (!err) {

              //res.send("UPdate OK!")
              redirectPage(res, req, 'vendorMaintain');
            }
          })
        })
      })
    })
  } else if (no != 'save') {//detail

    conn.connect().then(function () {
      var sqlQuery = "select * from vendor where id = " + id;
      var reqsql = new sql.Request(conn);
      console.log(sqlQuery);
      reqsql.query(sqlQuery).then(function (result) {

        //console.log(result.recordset);

        res.render('vendorMaintainDetail', {
          title: '廠商維護',
          users: ['活動維護', '商品維護', '廠商維護', '會員維護'],
          sqldetail: result.recordset

        });

      }).catch(function (err) {
        console.log('query-err');
        console.log(err);

      });
    }).catch(function (err) {
      console.log('conn-err');
      console.log(err);

    });
  }

});

app.get('/memberMaintain', function (req, res) {
  validSession(req, res);
  conn.connect().then(function () {
    var sqlQuery = "select * from member ";
    var reqsql = new sql.Request(conn);
    reqsql.query(sqlQuery).then(function (result) {
      //console.log(result.recordset);
      //console.log(result.recordset.length);

      res.render('memberMaintain', {
        title: '會員維護',
        users: ['活動維護', '商品維護', '廠商維護', '會員維護'],
        sqlRS: result.recordset,
        req: req
      });

    }).catch(function (err) {
      console.log('err2');
      console.log(err);

    });
  }).catch(function (err) {
    console.log('err2');
    console.log(err);

  });
});

app.get('/memberMaintainDetail/:no', function (req, res) {


  console.log(req.session.status);
  validSession(req, res);

  var no = req.params.no;
  //var id = req.query.id;

  var type = no.split('-')[0];
  var id = no.split('-')[1];
  console.log('type-----' + type);
  console.log('no-----' + no);

  if (type == 'delete') {

    console.log('delete id=' + id);

    //res.send("delete OK!")

    conn.connect().then(function (err) {
      const ps = new sql.PreparedStatement(conn)
      ps.input('id', sql.Int)

      ps.prepare('delete from member where id=@id', err => {
        // ... error checks
        ps.execute({ id: id }, (err, result) => {
          // ... error checks
          // release the connection after queries are executed
          ps.unprepare(err => {
            // ... error checks
            if (!err) {

              redirectPage(res, req, 'memberMaintain');

            }
          })
        })
      })
    })
  } else if (no == 'insert') {

    console.log('insert into');
    var memberno = req.query.memberno;
    var pwd = req.query.pwd;
    var gender = req.query.gender;
    var username = req.query.username;
    var birthday = req.query.birthday;
    var cellphone = req.query.cellphone;
    var address = req.query.address;
    var mail = req.query.mail;
    var joindate = req.query.joindate;
    var point = req.query.point;
    var authority = req.query.authority;

    console.log(req.query);

    conn.connect().then(function (err) {
      const ps = new sql.PreparedStatement(conn)

      //ps.input('id', sql.Int)
      ps.input('memberno', sql.NVarChar)
      ps.input('pwd', sql.NVarChar)
      ps.input('gender', sql.NVarChar)
      ps.input('username', sql.NVarChar)
      ps.input('birthday', sql.Date)
      ps.input('cellphone', sql.NVarChar)
      ps.input('address', sql.NVarChar)
      ps.input('mail', sql.NVarChar)
      ps.input('joindate', sql.Date)
      ps.input('point', sql.Int)
      ps.input('authority', sql.Int)

      ps.prepare('insert into member (memberno,pwd,gender,username,birthday,cellphone,address,mail,joindate,point,authority) \
                        values(@memberno,@pwd,@gender,@username,@birthday,@cellphone,@address,@mail,@joindate,@point,@authority ) ', err => {
        // ... error checks ,@content,@exchangecode
        ps.execute({
          memberno: memberno, pwd: pwd, gender: gender, username: username, birthday: birthday, cellphone: cellphone,
          address: address, mail: mail, joindate: joindate, point: point, authority: authority
        }, (err, result) => {
          // ... error checks
          // release the connection after queries are executed
          ps.unprepare(err => {
            // ... error checks
            if (!err) {
              redirectPage(res, req, 'memberMaintain');

            }
          })
        })
      })
    })

  } else if (no == 'add') {

    conn.connect().then(function () {
      var sqlQuery = "select * from member where memberno = '" + no + "'";;
      var reqsql = new sql.Request(conn);
      reqsql.query(sqlQuery).then(function (result) {
        //console.log(sqlQuery);
        //console.log(result.recordset);

        res.render('memberMaintainDetail', {
          title: '會員維護',
          users: ['活動維護', '商品維護', '廠商維護', '會員維護'],
          sqldetail: result.recordset

        });

      }).catch(function (err) {
        //console.log('err2');
        //console.log(err);

      });
    }).catch(function (err) {
      //console.log('err2');
      //console.log(err);

    });

  } else if (type == 'save') {

    id = req.query.id;
    console.log('intoSAV');
    //console.log('intoSAV--id--' + id);

    //var memberno = req.query.memberno;
    var pwd = req.query.pwd;
    var gender = req.query.gender;
    var username = req.query.username;
    var birthday = req.query.birthday;
    var cellphone = req.query.cellphone;
    var address = req.query.address;
    var mail = req.query.mail;
    var joindate = req.query.joindate;
    var point = req.query.point;
    var authority = req.query.authority;


    console.log(req.query);

    conn.connect().then(function (err) {
      const ps = new sql.PreparedStatement(conn)
      ps.input('id', sql.Int)
      //ps.input('memberno', sql.NVarChar)
      ps.input('pwd', sql.NVarChar)
      ps.input('gender', sql.NVarChar)
      ps.input('username', sql.NVarChar)
      ps.input('birthday', sql.Date)
      ps.input('cellphone', sql.NVarChar)
      ps.input('address', sql.NVarChar)
      ps.input('mail', sql.NVarChar)
      ps.input('joindate', sql.Date)
      ps.input('point', sql.Int)
      ps.input('authority', sql.Int)

      ps.prepare('update member set pwd=@pwd,gender=@gender ,username=@username,birthday=@birthday,cellphone=@cellphone\
      ,address=@address,mail=@mail,joindate=@joindate,point=@point,authority=@authority where id =@id', err => {
        // ... error checks
        ps.execute({
          id: id, pwd: pwd, gender: gender, username: username, birthday: birthday, cellphone: cellphone,
          address: address, mail: mail, joindate: joindate, point: point, authority: authority
        }, (err, result) => {
          // ... error checks
          // release the connection after queries are executed
          ps.unprepare(err => {
            // ... error checks
            if (!err) {

              //res.send("UPdate OK!")
              redirectPage(res, req, 'memberMaintain');
            }
          })
        })
      })
    })
  } else if (no != 'save') {//detail

    conn.connect().then(function () {
      var sqlQuery = "select * from member where id = " + id;
      var reqsql = new sql.Request(conn);
      console.log(sqlQuery);
      reqsql.query(sqlQuery).then(function (result) {

        res.render('memberMaintainDetail', {
          title: '會員維護',
          users: ['活動維護', '商品維護', '廠商維護', '會員維護'],
          sqldetail: result.recordset

        });

      }).catch(function (err) {
        console.log('query-err');
        console.log(err);

      });
    }).catch(function (err) {
      console.log('conn-err');
      console.log(err);

    });
  }

});


function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function redirectPage(res, req, page) {
  res.render('redirectPage', { title: page, req: req });
}

function validSession(req, res) {

  if (req.session.status != 'loginsuccess') {
    console.log('session time out.');
    req.session.status = 'logout';

    redirectPage(res, req, 'login');

  }
}



//--------------------------------------------------steven---------------------------------------------------------

/** 參加活動 Start */
app.get('/joinActivity', function (req, res) {
  validSession(req, res);
  conn.connect().then(function () {
    var sqlQuery = "select * from activity " +
      "where activityno in (select activityno from joinactivity " +
      "                      where memberno = '" + req.session.memberno + "'" +
      "                      and thisstatus = ':thisstatus')";
    var request = new sql.Request(conn);
    var his_activity = null;
    console.log(sqlQuery.replace(":thisstatus", 1));
    request.query(sqlQuery.replace(":thisstatus", 1)).then(function (result) {
      his_activity = result.recordset;
      request.query(sqlQuery.replace(":thisstatus", 0)).then(function (result) {
        res.render('joinActivityView', {
          title: "參加活動",
          activity: result.recordset,
          his_activity: his_activity,
          req: req
        });

        conn.close();
      }).catch(function (err) {
        conn.close();
      });
    }).catch(function (err) {
    });
  });
});

app.get('/joinActivityDetail', function (req, res) {
  validSession(req, res);
  var activityno = req.query.activityno;
  conn.connect().then(function () {
    var sqlQuery = "select * from activity where activityno = '" + activityno + "'";
    var request = new sql.Request(conn);
    request.query(sqlQuery).then(function (result) {
      res.render('joinActivityDetail', {
        title: "參加活動",
        activity: result.recordset,
        req: req,
      });

      conn.close();
    }).catch(function (err) {
      conn.close();
    });
  }).catch(function (err) {
  });
});

app.post('/exchange', function (req, res) {
  var activityno = req.body.activityno;
  var exchange = req.body.exchange;
  conn.connect().then(function () {
    var sqlQuery = "select * from activity where activityno = '" + activityno + "' and exchangecode = '" + exchange + "'";
    var request = new sql.Request(conn);
    request.query(sqlQuery).then(function (result) {
      if (result.recordset.length > 0) {
        var updatePoint = "update member " +
          "set point = (point + (select point from activity where activityno = '" + activityno + "')) " +
          "where memberno = '" + req.session.memberno + "' ";
        request.query(updatePoint).then(function (result) {
          var updateActivity = "update joinactivity " +
            "set receivepoint = 1, thisstatus = 1, finishtime = getdate() " +
            "where activityno = '" + activityno + "'" +
            "and memberno = '" + req.session.memberno + "'";
          request.query(updateActivity).then(function (result) {
            var updateInventoryAccount = "update activity " +
              "set activitypoint = (activitypoint - (select point from activity where activityno = '" + activityno + "')) " +
              "where activityno = '"+activityno+"' ";//提撥戶
            request.query(updateInventoryAccount)
            res.end('{"result" : "Y", "status" : 200}');
          });
        });
      }
      else {
        res.end('{"result" : "N", "status" : 200}');
      }
    });
  });
});
/** 參加活動 End */

/** 取消參加活動 Start*/
/** 第一種寫法 */
/* 
app.post('/cancle',  (req, res)=> {
 let {activityno,memberno} = req.body;
 conn.connect().then( (err)=> {
   const ps = new sql.PreparedStatement(conn)
   ps.input('activityno', sql.NVarChar)
   ps.input('memberno', sql.NVarChar)

   ps.prepare('delete from joinactivity where activityno=@activityno and memberno=@memberno', err => {
     // ... error checks
     ps.execute({ activityno: activityno,memberno:memberno }, (err, result) => {
       // ... error checks
       // release the connection after queries are executed
       ps.unprepare(err => {
         // ... error checks
         if (!err) {
           res.end('{"result" : "Y", "status" : 200}');

         }
       })
     })
   })
 })
});
*/

/** 第二種寫法 */
/*
app.post('/cancle',  (req, res)=> {
  let {activityno,memberno} = req.body;
    conn.connect().then((err)=> {
    let request=new sql.Request(conn);
    let deleteQuery="delete from joinactivity where activityno='"+activityno+ "'and memberno='"+memberno+"'"
    request
    .query(deleteQuery,(err,result)=>{
      if(err){
        console.log(err);
        res.end('{"result" : "N", "status" : 200}');
      }
      else{
        console.log(result)
        res.end('{"result" : "Y", "status" : 200}');
      }
    })
  })
});
*/
app.get('/cancle', (req, res) => {
  let { activityno, memberno } = req.query;
  conn.connect().then((err) => {
    let request = new sql.Request(conn);
    let deleteQuery = "delete from joinactivity where activityno='" + activityno + "'and memberno='" + memberno + "'"
    request
      .query(deleteQuery,

        (err, result) => {
          if (err) {
            console.log(err);
            res.end('{"result" : "N", "status" : 200}');
          }
          else {
            console.log(result)
            res.end('{"result" : "Y", "status" : 200}');
          }
        })
  })
});
/** 取消參加活動 End */

/** 商品庫存 Start */
app.get('/inventory', function (req, res) {
  validSession(req, res);
  conn.connect().then(function () {
    var sqlQuery = "select item.itemno, item.itemname, item.quantity, sum(e.exchangevolume) as exchangevolume from item " +
      "left join exchangerecord e on item.itemno = e.itemno and e.thisstatus = 0 " +
      "group by item.itemno, item.itemname, item.quantity ";
    var request = new sql.Request(conn);
    request.query(sqlQuery).then(function (result) {
      res.render('inventoryView', {
        title: "商品庫存",
        inventory: result.recordset,
        req: req
      });

      conn.close();
    }).catch(function (err) {
      conn.close();
    });
  }).catch(function (err) {
  });
});

app.get('/inventoryDetail', function (req, res) {
  validSession(req, res);
  var itemno = req.query.itemno;
  conn.connect().then(function () {
    var sqlQuery = "select item.itemname, item.quantity, e.memberno, member.username, e.exchangevolume from item " +
      "left join exchangerecord e on item.itemno = e.itemno and e.thisstatus = 0 " +
      "left join member on e.memberno = member.memberno " +
      "where item.itemno = '" + itemno + "'";

    var request = new sql.Request(conn);
    request.query(sqlQuery).then(function (result) {
      res.render('inventoryDetail', {
        title: "商品庫存",
        inventory: result.recordset,
        req: req
      });

      conn.close();
    }).catch(function (err) {
      conn.close();
    });
  }).catch(function (err) {
  });
});
/** 商品庫存 End */

/** 可兌換商品 Start */
app.get('/exchangeAbleGoods', function (req, res) {
  validSession(req, res);

  conn.connect().then(function () {
    var sqlQuery = "select * from item " +
      "where quantity > 0";

    var request = new sql.Request(conn);
    request.query("select point from member where memberno = '" + req.session.memberno + "' ").then(function (result) {
      req.session.point = result.recordset[0].point

      request.query(sqlQuery).then(function (result) {

        res.render('exchangeAbleGoodsView', {
          title: "可兌換商品",
          exchangeAbleGoodsView: result.recordset,
          req: req
        });

        conn.close();
      }).catch(function (err) {
        conn.close();
      });
    }).catch(function (err) {
    });
  });
});

app.get('/exchangeAbleGoodsDetail', function (req, res) {
  validSession(req, res);
  var itemno = req.query.itemno;
  conn.connect().then(function () {
    var sqlQuery = "select * from item " +
      "where quantity > 0 " +
      "and itemno = '" + itemno + "'";

    var request = new sql.Request(conn);
    request.query(sqlQuery).then(function (result) {
      res.render('exchangeAbleGoodsDetail', {
        title: "可兌換商品",
        exchangeAbleGoodsDetail: result.recordset,
        req: req
      });

      conn.close();
    }).catch(function (err) {
      conn.close();
    });
  }).catch(function (err) {
  });
});

app.post('/exchangeAbleGoodsLog', function (req, res) {
  validSession(req, res);
  var itemno = req.body.itemno;
  var itemname = req.body.itemname;
  var pointsspent = req.body.pointsspent;
  var memberno = req.body.memberno;
  var exchangevolume = req.body.exchangevolume
  conn.connect().then(function (err) {
    const ps = new sql.PreparedStatement(conn)
    conn.connect().then(function (err) {
      ps.input('memberno', sql.NVarChar);
      ps.prepare('select * from member where memberno = @memberno', err => {
        ps.execute({ memberno: memberno }, (err, result) => {
          ps.unprepare(err => {
            if (!err) {
              if (result.recordset[0].point > pointsspent) {
                conn.connect().then(function () {
                  var updateMember = "update member " +
                    "set point = (select point from member where memberno ='" + memberno + "') - " + pointsspent + " " +
                    "where memberno ='" + memberno + "'";
                  var request = new sql.Request(conn);

                  request.query(updateMember).then(function () {
                    request.query("select point from member where memberno = '" + memberno + "' ").then(function (result) {
                      req.session.point = result.recordset[0].point
                      request.query("update member set point = point + " + pointsspent+ " where authority =5 ").then(result=>{

                        if(!err){
                          console.log('update authority 5 sucess')
                        }else{

                          console.log('update authority 5 failed')
                        }

                      })
                    });
  
                    const ps = new sql.PreparedStatement(conn);
                    ps.input('itemno', sql.NVarChar);
                    ps.input('itemname', sql.NVarChar);
                    ps.input('pointsspent', sql.Int);
                    ps.input('memberno', sql.NVarChar);
                    ps.input('exchangevolume', sql.Int);
                    ps.prepare('insert into exchangerecord values (@itemno, @itemname, @pointsspent, getDate(), @memberno, @exchangevolume, 0)', err => {
                      ps.execute({
                        itemno: itemno, itemname: itemname, pointsspent: pointsspent,
                        memberno: memberno, exchangevolume: exchangevolume
                      }, (err, result) => {
                        ps.unprepare(err => {
                          if (!err) {
                            conn.connect().then(function () {
                              var updateItem = "update item " +
                                "set quantity = (select quantity from item where itemno ='" + itemno + "') - " + exchangevolume + " " +
                                "where itemno ='" + itemno + "'";

                              var request = new sql.Request(conn);
                              request.query(updateItem).then(function () {
                                conn.close();
                              });
                            }).catch(function (err) {
                              conn.close();
                            });

                            res.end('{"result" : "Y", "status" : 200}');
                          } else {
                            res.end('{"result" : "N", "status" : 200}');
                          }
                        });
                      }
                      )
                    })
                  });
                }).catch(function (err) {
                  conn.close();
                });
              } else {
                res.end('{"result" : "S", "status" : 200}');
              }
            }
          })
        });
      });
    });
  });
});
/** 可兌換商品 End */

/** 已兌換商品 Start */
app.get('/exchangeGoods', function (req, res) {
  validSession(req, res);
  var itemno = req.query.itemno;
  conn.connect().then(function () {
    var sqlQuery = "select * from exchangerecord " +
      "where memberno = '" + req.session.memberno + "' " +
      "order by thisstatus, exchangetime desc ";

    var request = new sql.Request(conn);
    request.query(sqlQuery).then(function (result) {
      res.render('exchangeGoodsView', {
        title: "已兌換商品",
        exchangeGoods: result.recordset,
        req: req
      });

      conn.close();
    }).catch(function (err) {
      conn.close();
    });
  }).catch(function (err) {
  });
});

app.post('/exchangeGoodsLog', function (req, res) {
  validSession(req, res);
  var id = req.body.id;

  console.log('exchangeGoodsLog--id-' + id);
  conn.connect().then(function (err) {
    const ps = new sql.PreparedStatement(conn)
    var request = new sql.Request(conn);
    ps.input('id', sql.Int)
    ps.prepare('update exchangerecord set thisstatus = 1 where id=@id', err => {
      ps.execute({ id: id }, (err, result) => {
        ps.unprepare(err => {
          if (!err) {
            var updateInventoryAccount = "update member set point = (select point from member where memberno ='A00002') +\
            (select amount from item where itemno= \
            (select itemno from exchangerecord where id='"+ id + "'))*(select exchangevolume from exchangerecord where id='" + id + "') \
              where memberno ='A00002'";//回存戶
            //console.log(updateInventoryAccount);
            request.query(updateInventoryAccount).then(function () {
              res.end('{"result" : "Y", "status" : 200}');
            });

          } else {
            res.end('{"result" : "N", "status" : 200}');
          }
        });
      }
      )
    })
  });
});
/** 已兌換商品 End */


/** 可參加活動 Start */
app.get('/joinActivityAble', function (req, res) {
  validSession(req, res);

  conn.connect().then(function () {
    var sqlQuery = "select * from activity " +
      "where convert(date, activity.activitydate, 112) >= convert(date, GETDATE(),112) " +
      "and activity.attendnumber > 0 " +
      "and activity.status = 2"
    "and activityno not in (select activityno from joinactivity " +
      "                        where memberno = '" + req.session.memberno + "' " +
      "                        and thisstatus = 0)";

    var request = new sql.Request(conn);
    request.query(sqlQuery).then(function (result) {
      res.render('joinActivityAbleView', {
        title: "可參加活動",
        joinActivityAbleView: result.recordset,
        req: req
      });

      conn.close();
    }).catch(function (err) {
      conn.close();
    });
  }).catch(function (err) {
  });
});

app.get('/joinActivityAbleDetail', function (req, res) {
  validSession(req, res);

  var itemno = req.query.itemno;
  conn.connect().then(function () {
    var sqlQuery = "select * from activity " +
      "where activityno = '" + itemno + "'" +
      "and convert(date, activity.activitydate, 112) >= convert(date, GETDATE(),112) "
      ;

    var request = new sql.Request(conn);
    request.query(sqlQuery).then(function (result) {
      res.render('joinActivityAbleDetail', {
        title: "參加活動",
        joinActivityAbleDetail: result.recordset,
        req: req
      });

      conn.close();
    }).catch(function (err) {
      conn.close();
    });
  }).catch(function (err) {
  });
});

app.post('/joinActivityAbleLog', function (req, res) {
  validSession(req, res);
  var activityno = req.body.activityno;
  conn.connect().then(function (err) {
    const ps = new sql.PreparedStatement(conn)
    conn.connect().then(function (err) {
      ps.input('activityno', sql.NVarChar);
      ps.prepare('update activity set attendnumber = (select attendnumber from activity where activityno = \'@activityno\') - 1 '
        + 'where activityno = \'@activityno\' ', err => {
          ps.execute({ activityno: activityno }, (err, result) => {
            ps.unprepare(err => {
              if (!err) {
                conn.connect().then(function () {
                  var updateJoinactivity = "insert into joinactivity values('" + activityno + "', '" + req.session.memberno + "', getdate(), 0, 0, null)";
                  var request = new sql.Request(conn);
                  request.query(updateJoinactivity).then(function () {
                    res.end('{"result" : "Y", "status" : 200}');
                  });
                }).catch(function (err) {
                  conn.close();
                });
              }
            })
          });
        });
    });
  });
});
/** 可參加活動 End */
/** 回收點數Start */

var time = '0 0 * * *'
*/10
var collectiontask = schedule.scheduleJob(time, () => {

  conn.connect().then(() => {
    console.log("connect sucess")
    let sqlQuery = "select * from  activity where activitydate < GETDATE() and status='2' and activitypoint >0"
    var request = new sql.Request(conn);
    request.query(sqlQuery).then((result) => {
      if (result.recordset.length==0) {
        console.log("Didn't need to collect");
      }
      else {
        console.log("testestsetestsetestestest")
        today = new Date();
        var year = today.getFullYear();
        var month = today.getMonth();
        var day = today.getDate();
        var scheduleDate = new Date(year, month, day, 00, 00, 00);
        result.recordset.forEach(element => {
          if (element.activitydate < scheduleDate) {
            var transaction = new sql.Transaction(conn);
            transaction.begin(err => {
              // ... error checks
              const request = new sql.Request(transaction)
              // let allactivityid = "'" + getactivityid.join("','") + "'"
              let sqlUpdate = "update activity set activitypoint=0 where id in (" + element.id + ")"
              request.query(sqlUpdate, (err) => {
                // ... error checks
                let sqlQuery = "update member set point=point+" + element.activitypoint + "where authority='6'"
                request.query(sqlQuery, err => {

                  if (!err) {
                    transaction.commit(err => {
                      if (err) { console.log("Transaction committed failed.") }
                      else {
                        console.log("Transaction committed.")
                        console.log("collection activitypoint:" + element.activitypoint)
                        console.log("collection id:" + element.id)
                        console.log("collection activityno:" + element.activityno)
                        console.log(scheduleDate)
                        console.log("------------collection End------------")
                      }
                    })
                  }
                  else {
                    transaction.rollback(() => {
                      console.log("Collection rollback");
                    })
                  }
                })
              })
            })
          }
        });
      }
    }).catch(function (err) {
      conn.close();
    });
  })
})
/**回收點數End */
/** 轉帳 */
/* 
app.get('/transfer', (req, res) => {
  validSession(req, res);
  let { id, memberno } = req.session;
  conn.connect().then(() => {
    var sqlQuery = "select * from member where memberno='" + memberno + "'";
    var request = new sql.Request(conn);
    request.query(sqlQuery).then((result) => {
      console.log(result)
      res.render('transfer', {
        title: "轉帳",
        result: result.recordset,
        req: req
      });
      conn.close();

    }).catch(function (err) {
      conn.close();
    });
  }).catch(function (err) {

  });
})
*/
//async await
app.get('/transfer', async (req, res) => {
  try{
  validSession(req, res);
  let { id, memberno } = req.session;
    await conn.connect()  
    var request = await new sql.Request(conn);
    var sqlQuery = "select * from member where memberno='" + memberno + "'";
    let result = await request.query(sqlQuery)
    console.log("async await");
    await res.render('transfer', {
      title: "轉帳",
      result: result.recordset,
      req: req
    });
  } catch(e){
    console.log(e)
  }
    });
    
/*
app.post('/transferDetail', function (req, res) {
  conn.connect().then(() => {
    console.log("connect sucess")
    let { myusername, mymemberno, memberno, mypwd, point } = req.body
    console.log("myusername:"+myusername, mymemberno, memberno, mypwd, point)
    console.log("mememberno:"+mymemberno)
    console.log("memberno:"+memberno)
    console.log("mypwd:"+mypwd)
    console.log("point:"+point)
    let sqlQuery = "select * from  member where point >='" + point + "' and memberno='" + mymemberno + "'and pwd='" + mypwd + "'"
    var request = new sql.Request(conn);
    request.query(sqlQuery).then(result => {
      console.log("select sucess")
      console.log(result)
      if(result.recordset.length>0){
      result.recordset.forEach(element => {
        console.log("forEach Start")
        var transaction = new sql.Transaction(conn);
        transaction.begin(err => {
          
          const request = new sql.Request(transaction)
          //   let allactivityid = "'" + getactivityid.join("','") + "'"
          let sqlUpdate = "update member set point=point-'" + point + "' where  memberno='" + mymemberno + "'and pwd='" + mypwd + "'"
          request.query(sqlUpdate, (err, result) => {
            if(result.rowsAffected==0){
              err="SQL rowsAffected = 0"
            }
            // ... error checks
            let sqlQuery = "update member set point=point+" + point + "where memberno='" + memberno + "'"
            request.query(sqlQuery, (err,result) => {
              if(result.rowsAffected==0){err="SQL作用數0"}
              console.log("----------------"+result.rowsAffected+"--------------")
              if (!err) {
                transaction.commit(err => {
                  if (err) {
                    console.log("Transaction committed failed.")
                    res.end('{"result" : "N", "status" : 200}');
                  }
                  else {
                    console.log("Transaction committed.")
                    console.log("Transfer memberno:" + element.memberno)
                    console.log("Transfer OriginalPoint:" + element.point)
                    console.log("Transfer Point:" + point)
                    console.log("Transfer To memberno" + memberno)
                    console.log("------------Transfer End------------")
                    conn.close();
                    res.end('{"result" : "Y", "status" : 200}');
                  }
                })
              } else {
                transaction.rollback(() => {
                  console.log("Transfer rollback");
                  res.end('{"result" : "N", "status" : 200}');
                })
              }
            })
          })
        })
      })}else{
        conn.close();
        res.end('{"result" : "N", "status" : 200}');

      }
    }).catch(e => {
      console.log(e)
      res.end('{"result" : "N", "status" : 200 "reason" : "餘額不足"}');
      conn.close();
      res.end('{"result" : "N", "status" : 200}');
    });
  }).catch(e => {
    console.log(e)
    conn.close();
  })
})
*/
/** 用then寫*/
app.post('/transferDetail',  (req, res)=> {
  let error = ""
  conn.connect().then(() => {
    console.log("connect sucess")
    let { myusername, mymemberno, memberno, mypwd, point } = req.body
    console.log("myusername:" + myusername, mymemberno, memberno, mypwd, point)
    console.log("mememberno:" + mymemberno)
    console.log("memberno:" + memberno)
    console.log("mypwd:" + mypwd)
    console.log("point:" + point)
    let sqlQuery = "select * from  member where point >='" + point + "' and memberno='" + mymemberno + "'and pwd='" + mypwd + "'"
    var request = new sql.Request(conn);
    request.query(sqlQuery).then(result => {
      console.log("select sucess")
      console.log(result.recordset)
      console.log("-----------------------------")
      if (result.recordset.length > 0) {
        result.recordset.forEach(element => {
          console.log("forEach Start")
          var transaction = new sql.Transaction(conn);
          transaction.begin(err => {
            const request = new sql.Request(transaction)
            //   let allactivityid = "'" + getactivityid.join("','") + "'"
            let sqlUpdate = "update member set point=point-'" + point + "' where  memberno='" + mymemberno + "'and pwd='" + mypwd + "'"
            request.query(sqlUpdate).then(err,result => {
              console.log("----------------" + result.rowsAffected + "--------------")
              err = "SQL rowsAffected = 0"
              if (result.rowsAffected != 0) {
               
           
              // ... error checks
              let sqlQuery = "update member set point=point+" + point + "where memberno='" + memberno + "'"
              request.query(sqlQuery).then(err,result => {
                if (result.rowsAffected == 0) { err = "SQL作用數0" }
                console.log("----------------" + result.rowsAffected + "--------------")

                if (!err) {
                  transaction.commit(err => {
                    if (err) {
                      console.log("Transaction committed failed.")
                      res.end('{"result" : "N", "status" : 200}');
                    }
                    else {
                      console.log("Transaction committed.")
                      console.log("Transfer memberno:" + element.memberno)
                      console.log("Transfer OriginalPoint:" + element.point)
                      console.log("Transfer Point:" + point)
                      console.log("Transfer To memberno" + memberno)
                      console.log("------------Transfer End------------")
                      conn.close();
                      res.end('{"result" : "Y", "status" : 200}');
                    }
                  })
                } else {
                  transaction.rollback(() => {
                    console.log("Transfer rollback");
                    res.end('{"result" : "N", "status" : 200}');
                  })
                }
              }).catch(e => {
                console.log(e)
                console.log("wrong memberno")
                conn.close();
                res.end('{"result" : "N", "status" : 200 "reason" : "會員編號錯誤"}');
              });
            }
          }).catch(e => {
              console.log(e)
              console.log("wrong password")
              conn.close();
              res.end('{"result" : "N", "status" : 200 "reason" : "密碼錯誤"}');
            });
          })
        })
      } else {
        conn.close();
        res.end('{"result" : "N", "status" : 200}');

      }
    }).catch(e => {
      console.log(e)
      console.log('no money')

      conn.close();
      res.end('{"result" : "N", "status" : 200 "reason" : "餘額不足"}');
    });
  }).catch(e => {
    console.log(e)
    conn.close();
  })
})
/**轉帳 */

