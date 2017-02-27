# moravian-bulk-import

A Node.js tool to import metadata into the Moravian memoirs metadata database [http://moravianlives.org:8001/admin] and simumlaneously import images into the Wordpress/Scripto transcription desk [http://moravianlives.org/memoirs/].

## How does it work?
The script reads a JSON input file (input/london.json for the London memoirs) that is following the field scheme described in the "london memoirs" spreadsheet on Google Drive. This can be done by exporting the spreadsheet as CSV and then we can convert it to JSON using this website: [http://www.convertcsv.com/csv-to-json.htm].
The script first looks for persons not existing in the metadata database and inserts metadata about them. Then the script goes through the full input file, creating document entries for each in the metadata database. Finally, it outputs a wp_import.xml file for importing the transcription images into Wordpress/Scripto.

## importPersons.js
It is important to run `node importPersons` first. This script will ensure that all persons in the input file exists in the metadata database before importing the documents. Splitting this into two files really just make everything easier as we are creating a lot of database entries (data entries and relations) and in many of those entries, we are depending on newly created id's.

## importDocuments
After persons have been inserted, we run `node importDocuments`. This will create new document entries with relations to persons found in the database. The script first searches the database for persons based on firstname, surname and years of birth and death.
Finally, this script writes wp_import.xml file which can we imported into Wordpress. The import file creates new `memoir` posts and several `attachment` posts with references to each image of each document. The images must be accessible on a web server in order for Wordpress to download the attachments. This is controlled in the `config.js` file.

## config.js
The `config.js` file contains configuration for the database connection. It also contains a url where the images are accessible. See more in the **images** section.
The structure of the config file is as following:
``` javascript
module.exports = {
	host: 'localhost',
	user: 'root',
	password: '',
	database : 'lebenslauf',
	imageUrl: 'http://localhost:8080/moravian-bulk-import/images/'
};
```

## Images
Image files are stored in subdirectories in the `images/` directory. The names of the subdirectories must follow this rule (using fields from the JSON file/spreadsheet):
```
[FirstName] [LastNameNormal] [ReferenceNr (where '/' has been replaced for '-')]
```
As an example: a directory with images for the person with the firstname Benjamin, surname Beck and reference number `C/36/3/96` will be `Benjamin Beck C-36-3-96`.

## Problems
This tool was build around the London Memoirs metadata. Using it for metadata from other sources might require some tweaks.

## To-do
* Fix matching or persons in the database and the spreadsheet in `importPersons.js` and `importDocuments.js`. Matching is based on names and years of birth and date, however, if not year is defined in the input data, it might find a person with matching name but with any birth or death year.
