var fs = require('fs');
var mysql = require('mysql');
var _ = require('underscore');

var connection = mysql.createConnection({
	host: config.host,
	user: config.user,
	password: config.password,
	database : config.database
});

connection.connect();

var currentItem = 0;

var processItems = function() {
	var item = dataItems[currentItem];

	var birthDate = item.DateBirth && String(item.DateBirth).split ? String(item.DateBirth).split('.') : item.DateBirth;
	var deathDate = item.DateDeath && String(item.DateDeath).split ? String(item.DateDeath).split('.') : item.DateDeath;

	var sql = 'SELECT * FROM persons WHERE ('+
		'surname = "'+item.LastNameNormal+'"'+(item.LastNameExac != '' ? ' OR surname_literal = "'+item.LastNameExac+'"' : '')+
		') AND '+
		'firstname = "'+item.FirstName+'"'+
		(
			birthDate && birthDate.length == 1 && Number(birthDate[0]) > 0 ? ' AND birth_year = '+birthDate[0] :
			birthDate && birthDate.length == 3 && Number(birthDate[2]) > 0 ? ' AND birth_year = '+birthDate[2] :
			''
		)+
		(
			deathDate && deathDate.length == 1 && Number(deathDate[0]) > 0 ? ' AND death_year = '+deathDate[0] :
			deathDate && deathDate.length == 3 && Number(deathDate[2]) > 0 ? ' AND death_year = '+deathDate[2] :
			''
		)
	;

	connection.query(sql, function(error, results, fields) {
		if (!results || results.length == 0) {
			console.log('----not found----');
			console.log('searched for: '+item.LastNameNormal+', '+item.FirstName+', '+item.DateBirth+' - '+item.DateDeath);

			var sql = 'INSERT INTO persons ('+
				'll_id, ll_idnum, page, surname_literal, surname, language, firstname, birthplace, ll_birthplace, deathplace, ll_deathplace, birth_year, birth_month, birth_day, ll_birth, death_year, death_month, death_day, ll_death, gender, ownhand, birthname, birthname_literal, system_group1, former_surname_literal, former_surname, familystatus, partner_name, comment, remove, reference, metadata, source) '+
					'VALUES ('+
				'"'+item.ReferenceNr+'", '+ // ll_id
				'NULL, '+ // ll_idnum
				'11, '+ // page
				'"'+item.LastNameExac+'", '+ // surname_literal
				'"'+item.LastNameNormal+'", '+ // surname
				'"english", '+ // language
				'"'+item.FirstName+'", '+ // firstname
				'NULL, '+ // birthplace
				'"", '+ // ll_birthplace
				'NULL, '+ // deathplace
				'"", '+ // ll_deathplace
				(
					birthDate && birthDate.length == 1 && Number(birthDate[0]) > 0 ? birthDate[0] :
					birthDate && birthDate.length == 3 && Number(birthDate[2]) > 0 ? birthDate[2] :
					'NULL'
				)+', '+ // birth_year
				(
					birthDate && birthDate.length == 3 && Number(birthDate[1]) > 0 ? birthDate[1] :
					'NULL'
				)+', '+ // birth_month
				(
					birthDate && birthDate.length == 3 && Number(birthDate[0]) > 0 ? +birthDate[0] :
					'NULL'
				)+', '+ // birth_day
				'"", '+ // ll_birth
				(
					deathDate && deathDate.length == 1 && Number(deathDate[0]) > 0 ? deathDate[0] :
					deathDate && deathDate.length == 3 && Number(deathDate[2]) > 0 ? deathDate[2] :
					'NULL'
				)+', '+ // death_year
				(
					deathDate && deathDate.length == 3 && Number(deathDate[1]) > 0 ? deathDate[1] :
					'NULL'
				)+', '+ // death_month
				(
					birthDate && deathDate.length == 3 && Number(deathDate[0]) > 0 ? +deathDate[0] :
					'NULL'
				)+', '+ // death_day
				'"", '+ // ll_death
				(item.Gender == 'm' ? 0 : item.Gender == 'f' ? 1 : 'null')+', '+ // gender
				(item.Autobiographical == 'TRUE' ? 1 : 0)+', '+ // ownhand
				'"", '+ // birthname
				'"", '+ // birthname_literal
				'"P", '+ // systemgroup
				'"", '+ // former_surname_literal
				'"", '+ // former_surname
				'"'+item.MaritalStatus+'", '+ // familystatus
				'"", '+ // partner_name
				'"'+item.DescriptionLog+'", '+ // comment
				'"", '+ // remove
				'"", '+ // reference
				'NULL, '+ // metadata
				'3)' // source
			;

			connection.query(sql, function(err, insertPersonResult) {
				if (item.PlaceBirth != '' || item.PlaceDeath != '') {
					if (item.PlaceBirth != '') {
						var birthPlaceSql = 'INSERT INTO places (name, name_en, area, area_en) VALUES ("'+item.PlaceBirth+'", "'+item.PlaceBirth+'", "'+item.RegionBirth+'", "'+item.RegionBirth+'")';
						connection.query(birthPlaceSql, function(err, birthPlaceResult) {
							connection.query('UPDATE persons SET birthplace = '+birthPlaceResult.insertId+' WHERE id = '+insertPersonResult.insertId);
							connection.query('INSERT INTO personplaces (person, place, relation) VALUES ('+insertPersonResult.insertId+', '+birthPlaceResult.insertId+', "b")');
						});
					}

					if (item.PlaceDeath != '') {
						var deathPlaceSql = 'INSERT INTO places (name, name_en, area, area_en) VALUES ("'+item.PlaceDeath+'", "'+item.PlaceDeath+'", "'+item.RegionDeath+'", "'+item.RegionDeath+'")';
						connection.query(deathPlaceSql, function(err, deathPlaceResult) {
							connection.query('UPDATE persons SET deathplace = '+deathPlaceResult.insertId+' WHERE id = '+insertPersonResult.insertId);
							connection.query('INSERT INTO personplaces (person, place, relation) VALUES ('+insertPersonResult.insertId+', '+deathPlaceResult.insertId+', "d")');
						});
					}
				}
			});

		}

		if (currentItem < dataItems.length-1) {
			currentItem++;

			processItems();
		}
	});
}

fs.readFile('input/london.json', function(err, fileData) {
	var data = JSON.parse(fileData);

	dataItems = data;

	processItems();
});