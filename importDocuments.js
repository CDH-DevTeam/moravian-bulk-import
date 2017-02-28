var fs = require('fs');
var mysql = require('mysql');
var _ = require('underscore');

var builder = require('xmlbuilder');

var config = require('./config');

var imageUrl = config.imageUrl;

// Set up mySQL connection
var connection = mysql.createConnection({
	host: config.host,
	user: config.user,
	password: config.password,
	database : config.database
});

connection.connect();

// Helper function to create WordPress plage slug (friendly url)
var toSlug = function(str) {
	str = str.replace(/^\s+|\s+$/g, ''); // trim
	str = str.toLowerCase();

	// remove accents, swap ñ for n, etc
	var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
	var to   = "aaaaeeeeiiiioooouuuunc------";

	for (var i=0, l=from.length ; i<l ; i++)
	{
		str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
	}

	str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
		.replace(/\s+/g, '-') // collapse whitespace and replace by -
		.replace(/-+/g, '-'); // collapse dashes

	return str;
}

var currentItem = 0;

/*
	Set up a transaction counter to help know when to write the output XML file
	The program adds to the counter every time a new mysql query is executed and
	decreases this number when the query has finished.
*/
var currentTransaction = 0;
var transactionCount = 0;
var attachmentCounter = 1;

// Set up the base XML structure
var xml = builder.create('rss');

xml.att('version', '2.0');
xml.att('xmlns:excerpt', 'http://wordpress.org/export/1.2/excerpt/');
xml.att('xmlns:content', 'http://purl.org/rss/1.0/modules/content/');
xml.att('xmlns:wfw', 'http://wellformedweb.org/CommentAPI/');
xml.att('xmlns:dc', 'http://purl.org/dc/elements/1.1/');
xml.att('xmlns:wp', 'http://wordpress.org/export/1.2/');

var xml_channel = xml.ele('channel');
xml_channel.ele('wp:wxr_version', {}, '1.2');

// Function to insert a new document to the database and retreive it's newly created ID
var getDocumentId = function(personId, documentData, callback) {
	/*
		TODO:
			Check if the document already exists and retreive existing ID instead of creating a new one
	*/
	var birthDate = documentData.DateBirth && String(documentData.DateBirth).split ? String(documentData.DateBirth).split('.') : documentData.DateBirth;
	var deathDate = documentData.DateDeath && String(documentData.DateDeath).split ? String(documentData.DateDeath).split('.') : documentData.DateDeath;

	var sql = 'INSERT INTO documents ('+
		'll_id, ll_idnum, page, surname_literal, surname, language, firstname, birthplace, ll_birthplace, deathplace, ll_deathplace, birth_year, birth_month, birth_day, ll_birth, death_year, death_month, death_day, ll_death, gender, ownhand, birthname, birthname_literal, system_group1, former_surname_literal, former_surname, familystatus, partner_name, comment, remove, reference, metadata, source) '+
			'VALUES ('+
		'"'+documentData.ReferenceNr+'", '+ // ll_id
		'NULL, '+ // ll_idnum
		'11, '+ // page
		'"'+documentData.LastNameExac+'", '+ // surname_literal
		'"'+documentData.LastNameNormal+'", '+ // surname
		'"english", '+ // language
		'"'+documentData.FirstName+'", '+ // firstname
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
		(documentData.Gender == 'm' ? 0 : documentData.Gender == 'f' ? 1 : 'null')+', '+ // gender
		(documentData.Autobiographical == 'TRUE' ? 1 : 0)+', '+ // ownhand
		'"", '+ // birthname
		'"", '+ // birthname_literal
		'"P", '+ // systemgroup
		'"", '+ // former_surname_literal
		'"", '+ // former_surname
		'"'+documentData.MaritalStatus+'", '+ // familystatus
		'"", '+ // partner_name
		'"'+documentData.DescriptionLog+'", '+ // comment
		'"", '+ // remove
		'"", '+ // reference
		'NULL, '+ // metadata
		'3)'; // source


	transactionCount++;
	connection.query(sql, function(err, result) {
		currentTransaction++;

		if (err) {
			console.log(err);
		}
		var documentId = result.insertId;

		var pdSql = 'INSERT INTO persondocuments (person, document) VALUES ('+personId+', '+documentId+')';

		transactionCount++;
		connection.query(pdSql, function(pderr, pdResult) {
			currentTransaction++;

			if (documentData.PlaceBirth != '' || documentData.PlaceDeath != '') {
				if (documentData.PlaceBirth != '') {
					var birthPlaceSql = 'INSERT INTO places (name, name_en, area, area_en) VALUES ("'+documentData.PlaceBirth+'", "'+documentData.PlaceBirth+'", "'+documentData.RegionBirth+'", "'+documentData.RegionBirth+'")';

					connection.query(birthPlaceSql, function(bperr, birthPlaceResult) {

						connection.query('UPDATE documents SET birthplace = '+birthPlaceResult.insertId+' WHERE id = '+documentId);
					});
				}

				if (documentData.PlaceDeath != '') {
					var deathPlaceSql = 'INSERT INTO places (name, name_en, area, area_en) VALUES ("'+documentData.PlaceDeath+'", "'+documentData.PlaceDeath+'", "'+documentData.RegionDeath+'", "'+documentData.RegionDeath+'")';

					connection.query(deathPlaceSql, function(dperr, deathPlaceResult) {

						connection.query('UPDATE documents SET deathplace = '+deathPlaceResult.insertId+' WHERE id = '+documentId);
					});
				}
			}
			callback(documentId);
		});
	});
}

// Function used to iterate each item of the JSON input file
var processItems = function() {

	// Function to check whether we should continue or write the output XML file
	var endOrContinue = function() {

		console.log('current: '+currentItem);
		console.log('currentTransaction: '+currentTransaction+', transactionCount: '+transactionCount);
		if (currentItem < dataItems.length-1) {
			currentItem++;

			processItems();
		}
		else if (currentTransaction == transactionCount) {

			// Check if all transactions have finished
			console.log('now I write!');
			fs.writeFile('wp_import.xml', xml.end({ pretty: true}), function(error) {
				if (error) {
					console.log(error);
				}
			});
		}
	}

	var item = dataItems[currentItem];

	var birthDate = item.DateBirth && String(item.DateBirth).split ? String(item.DateBirth).split('.') : item.DateBirth;
	var deathDate = item.DateDeath && String(item.DateDeath).split ? String(item.DateDeath).split('.') : item.DateDeath;

	// Build up a query to get the persons ID (assuming it is in the database after running importPersons.js)
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

	transactionCount++;

	// Run the query
	connection.query(sql, function(error, results, fields) {
		currentTransaction++;

		if (results && results.length > 0) {
			// Continue if the person was found
			console.log('--------');
			console.log('searched for: '+item.LastNameNormal+', '+item.FirstName+', '+item.DateBirth+' - '+item.DateDeath);

			// Check if the folder with the name of the document reference number exists
			var folderName = (item.FirstName+' '+item.LastNameNormal).replace('  ', ' ')+' '+item.ReferenceNr.split('/').join('-');
			if (fs.existsSync('images/'+folderName)) {

				// Insert new document and get the new ID
				getDocumentId(results[0].id, item, function(docId) {

					// Add data to output XML
					var xml_item = xml_channel.ele('item');

					var itemTitle = item.FirstName+' '+item.LastNameNormal;

					xml_item.ele('title', {}, itemTitle);
					xml_item.ele('link', {}, 'http://moravianlives.org/memoirs/'+toSlug(itemTitle));
					xml_item.ele('pubDate', {}, (new Date()).toUTCString());
					xml_item.ele('dc:creator').dat('moravian-bulk-import');
		//				xml_item.ele('guid isPermaLink="false">http://moravianlives.org/?p=90');
					xml_item.ele('description', {}, '');
					xml_item.ele('content:encoded', {}).dat('<strong>'+results[0].birth_day+'.'+results[0].birth_month+'.'+results[0].birth_year+'-'+results[0].death_day+'.'+results[0].death_month+'.'+results[0].death_year+'</strong><br/><br/>Source: '+item.ReferenceNr);
					xml_item.ele('excerpt:encoded').dat('');
					xml_item.ele('wp:post_id', {}, docId);
					xml_item.ele('wp:post_date').dat((new Date()).toISOString().replace('T', ' ').split('.')[0]);
					xml_item.ele('wp:post_date_gmt').dat((new Date()).toISOString().replace('T', ' ').split('.')[0]);
					xml_item.ele('wp:comment_status').dat('closed');
					xml_item.ele('wp:ping_status').dat('closed');
					xml_item.ele('wp:post_name').dat(toSlug(itemTitle));
					xml_item.ele('wp:status').dat('publish');
					xml_item.ele('wp:post_parent', {}, '0');
					xml_item.ele('wp:post_type').dat('memoirs');
					xml_item.ele('wp:is_sticky', {}, '0');

					// Add document ID as a tag to WP import item
					xml_item.ele('category', {'domain': 'post_tag', 'nicename': docId}).dat(docId);
					xml_item.ele('category', {'domain': 'memoir-archive', 'nicename': 'london'}).dat('London');
					xml_item.ele('category', {'domain': 'memoir-language', 'nicename': 'english'}).dat('English');
		/*
					xml_item.ele('category', {'domain': 'memoir-countries', 'nicename': 'germany'}).dat('Germany');
					xml_item.ele('category', {'domain': 'memoir-countries', 'nicename': 'usa'}).dat('USA');
		*/

					var files = fs.readdirSync('images/'+folderName);

					var fileCounter = 1;

					// Iterate each image file and add it to the output XML
					_.each(files, function(file) {

						var xml_attachment = xml_channel.ele('item');

						var fileUrl = imageUrl+folderName+'/'+file;
						xml_attachment.ele('title', {}, toSlug(itemTitle)+'-'+fileCounter);
						xml_attachment.ele('link', {}, 'http://moravianlives.org/memoirs/'+toSlug(itemTitle));
						xml_attachment.ele('pubDate', {}, (new Date()).toUTCString());
						xml_attachment.ele('dc:creator').dat('moravian-bulk-import');
						xml_attachment.ele('guid', {'isPermaLink': 'false'}, fileUrl);
						xml_attachment.ele('description', {}, '');
						xml_attachment.ele('content:encoded', {}).dat('<strong>'+results[0].birth_day+'.'+results[0].birth_month+'.'+results[0].birth_year+'-'+results[0].death_day+'.'+results[0].death_month+'.'+results[0].death_year+'</strong><br/><br/>Source: '+item.ReferenceNr);
						xml_attachment.ele('excerpt:encoded').dat('');
	//					xml_attachment.ele('wp:post_id', {}, results[0].id);
						xml_attachment.ele('wp:post_date').dat((new Date()).toISOString().replace('T', ' ').split('.')[0]);
						xml_attachment.ele('wp:post_date_gmt').dat((new Date()).toISOString().replace('T', ' ').split('.')[0]);
						xml_attachment.ele('wp:comment_status').dat('closed');
						xml_attachment.ele('wp:ping_status').dat('closed');
						xml_attachment.ele('wp:post_name').dat(toSlug(itemTitle)+'-'+fileCounter);
						xml_attachment.ele('wp:status').dat('publish');
						xml_attachment.ele('wp:post_parent', {}, docId);

						// Set post_type as attachment
						xml_attachment.ele('wp:post_type').dat('attachment');
						xml_attachment.ele('wp:is_sticky', {}, '0');
						xml_attachment.ele('wp:attachment_url').dat(fileUrl);

						fileCounter++;

						endOrContinue();
					});
				});
			}
			else {
				endOrContinue();
			}
		} else {		
			endOrContinue();
		}

	});
}

/*
	Read the input JSON file and iterate each item of the file
	The JSON file is defined as a command-line parameter (node importDocuments input/filename.json)
*/
if (process.argv[2]) {
	fs.readFile(process.argv[2], function(err, fileData) {
		console.log('Open '+process.argv[2]);

		if (err) {
			console.log(err);
			connection.end();
		}

		var data = JSON.parse(fileData);

		dataItems = data;

		processItems();
	});
}
else {
	console.log('Missing json input file parameter.');
	console.log('Example: node importPersons.js [input.json])');

	connection.end();
}