/* Konfigurace a datové mapování pro Vakcinační mapu světa. */

const CN={4:"Afghanistan",8:"Albania",12:"Algeria",24:"Angola",32:"Argentina",51:"Armenia",36:"Australia",40:"Austria",31:"Azerbaijan",50:"Bangladesh",112:"Belarus",56:"Belgium",84:"Belize",204:"Benin",64:"Bhutan",68:"Bolivia",70:"Bosnia and Herzegovina",72:"Botswana",76:"Brazil",100:"Bulgaria",854:"Burkina Faso",108:"Burundi",116:"Cambodia",120:"Cameroon",124:"Canada",140:"Central African Republic",148:"Chad",152:"Chile",156:"China",170:"Colombia",178:"Republic of the Congo",180:"DR Congo",188:"Costa Rica",191:"Croatia",192:"Cuba",196:"Cyprus",203:"Czech Republic",208:"Denmark",262:"Djibouti",214:"Dominican Republic",218:"Ecuador",818:"Egypt",222:"El Salvador",226:"Equatorial Guinea",232:"Eritrea",233:"Estonia",231:"Ethiopia",246:"Finland",250:"France",266:"Gabon",270:"Gambia",268:"Georgia",276:"Germany",288:"Ghana",300:"Greece",320:"Guatemala",324:"Guinea",624:"Guinea-Bissau",328:"Guyana",332:"Haiti",340:"Honduras",348:"Hungary",356:"India",360:"Indonesia",364:"Iran",368:"Iraq",372:"Ireland",376:"Israel",380:"Italy",388:"Jamaica",392:"Japan",400:"Jordan",398:"Kazakhstan",404:"Kenya",408:"North Korea",410:"South Korea",414:"Kuwait",417:"Kyrgyzstan",418:"Laos",428:"Latvia",422:"Lebanon",426:"Lesotho",430:"Liberia",434:"Libya",440:"Lithuania",807:"North Macedonia",450:"Madagascar",454:"Malawi",458:"Malaysia",466:"Mali",478:"Mauritania",484:"Mexico",498:"Moldova",496:"Mongolia",499:"Montenegro",504:"Morocco",508:"Mozambique",104:"Myanmar",516:"Namibia",524:"Nepal",528:"Netherlands",554:"New Zealand",558:"Nicaragua",562:"Niger",566:"Nigeria",578:"Norway",512:"Oman",586:"Pakistan",591:"Panama",598:"Papua New Guinea",600:"Paraguay",604:"Peru",608:"Philippines",616:"Poland",620:"Portugal",642:"Romania",643:"Russia",682:"Saudi Arabia",686:"Senegal",688:"Serbia",694:"Sierra Leone",703:"Slovakia",705:"Slovenia",706:"Somalia",710:"South Africa",728:"South Sudan",724:"Spain",144:"Sri Lanka",729:"Sudan",748:"Eswatini",752:"Sweden",756:"Switzerland",760:"Syria",762:"Tajikistan",834:"Tanzania",764:"Thailand",626:"Timor-Leste",768:"Togo",780:"Trinidad and Tobago",788:"Tunisia",792:"Turkey",795:"Turkmenistan",800:"Uganda",804:"Ukraine",784:"United Arab Emirates",826:"United Kingdom",840:"United States",858:"Uruguay",860:"Uzbekistan",862:"Venezuela",704:"Vietnam",887:"Yemen",894:"Zambia",716:"Zimbabwe",20:"Andorra",28:"Antigua and Barbuda",44:"Bahamas",48:"Bahrain",52:"Barbados",96:"Brunei",132:"Cape Verde",174:"Comoros",242:"Fiji",296:"Kiribati",308:"Grenada",336:"Vatican City",352:"Iceland",384:"Cote d'Ivoire",438:"Liechtenstein",442:"Luxembourg",462:"Maldives",470:"Malta",480:"Mauritius",492:"Monaco",520:"Nauru",548:"Vanuatu",583:"Micronesia",584:"Marshall Islands",585:"Palau",634:"Qatar",646:"Rwanda",674:"San Marino",678:"Sao Tome and Principe",690:"Seychelles",702:"Singapore",90:"Solomon Islands",740:"Suriname",776:"Tonga",798:"Tuvalu",882:"Samoa",304:"Greenland",540:"New Caledonia",630:"Puerto Rico",158:"Taiwan",383:"Kosovo",732:"Western Sahara",136:"Cayman Islands",184:"Cook Islands",212:"Dominica",254:"French Guiana",258:"French Polynesia",312:"Guadeloupe",344:"Hong Kong",474:"Martinique",535:"Bonaire, Sint Eustatius and Saba",638:"Reunion",652:"Saint Barthelemy",659:"Saint Kitts and Nevis",662:"Saint Lucia",663:"Saint Martin",670:"Saint Vincent and the Grenadines",796:"Turks and Caicos Islands",850:"United States Virgin Islands"};

const CZ={4:"Afghánistán",8:"Albánie",12:"Alžírsko",24:"Angola",32:"Argentina",51:"Arménie",36:"Austrálie",40:"Rakousko",31:"Ázerbájdžán",50:"Bangladéš",112:"Bělorusko",56:"Belgie",84:"Belize",204:"Benin",64:"Bhútán",68:"Bolívie",70:"Bosna a Hercegovina",72:"Botswana",76:"Brazílie",100:"Bulharsko",854:"Burkina Faso",108:"Burundi",116:"Kambodža",120:"Kamerun",124:"Kanada",140:"Středoafrická republika",148:"Čad",152:"Chile",156:"Čína",170:"Kolumbie",178:"Kongo",180:"DR Kongo",188:"Kostarika",191:"Chorvatsko",192:"Kuba",196:"Kypr",203:"Česká republika",208:"Dánsko",262:"Džibutsko",214:"Dominikánská republika",218:"Ekvádor",818:"Egypt",222:"Salvador",226:"Rovníková Guinea",232:"Eritrea",233:"Estonsko",231:"Etiopie",246:"Finsko",250:"Francie",266:"Gabon",270:"Gambie",268:"Gruzie",276:"Německo",288:"Ghana",300:"Řecko",320:"Guatemala",324:"Guinea",624:"Guinea-Bissau",328:"Guyana",332:"Haiti",340:"Honduras",348:"Maďarsko",356:"Indie",360:"Indonésie",364:"Írán",368:"Irák",372:"Irsko",376:"Izrael",380:"Itálie",388:"Jamajka",392:"Japonsko",400:"Jordánsko",398:"Kazachstán",404:"Keňa",408:"Severní Korea",410:"Jižní Korea",414:"Kuvajt",417:"Kyrgyzstán",418:"Laos",428:"Lotyšsko",422:"Libanon",426:"Lesotho",430:"Libérie",434:"Libye",440:"Litva",807:"Severní Makedonie",450:"Madagaskar",454:"Malawi",458:"Malajsie",466:"Mali",478:"Mauritánie",484:"Mexiko",498:"Moldavsko",496:"Mongolsko",499:"Černá Hora",504:"Maroko",508:"Mozambik",104:"Myanmar",516:"Namibie",524:"Nepál",528:"Nizozemsko",554:"Nový Zéland",558:"Nikaragua",562:"Niger",566:"Nigérie",578:"Norsko",512:"Omán",586:"Pákistán",591:"Panama",598:"Papua Nová Guinea",600:"Paraguay",604:"Peru",608:"Filipíny",616:"Polsko",620:"Portugalsko",642:"Rumunsko",643:"Rusko",682:"Saúdská Arábie",686:"Senegal",688:"Srbsko",694:"Sierra Leone",703:"Slovensko",705:"Slovinsko",706:"Somálsko",710:"Jihoafrická republika",728:"Jižní Súdán",724:"Španělsko",144:"Srí Lanka",729:"Súdán",748:"Eswatini",752:"Švédsko",756:"Švýcarsko",760:"Sýrie",762:"Tádžikistán",834:"Tanzanie",764:"Thajsko",626:"Východní Timor",768:"Togo",780:"Trinidad a Tobago",788:"Tunisko",792:"Turecko",795:"Turkmenistán",800:"Uganda",804:"Ukrajina",784:"Spojené arabské emiráty",826:"Velká Británie",840:"USA",858:"Uruguay",860:"Uzbekistán",862:"Venezuela",704:"Vietnam",887:"Jemen",894:"Zambie",716:"Zimbabwe",20:"Andorra",28:"Antigua a Barbuda",44:"Bahamy",48:"Bahrajn",52:"Barbados",96:"Brunej",132:"Kapverdy",174:"Komory",242:"Fidži",296:"Kiribati",308:"Grenada",336:"Vatikán",352:"Island",384:"Pobřeží slonoviny",438:"Lichtenštejnsko",442:"Lucembursko",462:"Maledivy",470:"Malta",480:"Mauricius",492:"Monako",520:"Nauru",548:"Vanuatu",583:"Mikronésie",584:"Marshallovy ostrovy",585:"Palau",634:"Katar",646:"Rwanda",674:"San Marino",678:"Svatý Tomáš a Princův ostrov",690:"Seychely",702:"Singapur",90:"Šalomounovy ostrovy",740:"Surinam",776:"Tonga",798:"Tuvalu",882:"Samoa",304:"Greenland",540:"New Caledonia",630:"Puerto Rico",158:"Taiwan",383:"Kosovo",732:"Západní Sahara",136:"Kajmanské ostrovy",184:"Cookovy ostrovy",212:"Dominika",254:"Francouzská Guyana",258:"Francouzská Polynésie",312:"Guadeloupe",344:"Hongkong",474:"Martinik",535:"Bonaire, Svatý Eustach a Saba",638:"Réunion",652:"Saint-Barthélemy",659:"Svatý Kryštof a Nevis",662:"Svatá Lucie",663:"Saint-Martin",670:"Svatý Vincenc a Grenadiny",796:"Turks a Caicos",850:"Americké Panenské ostrovy"};

/* Území, která mapový podklad pojmenovává anglicky (a často zkratkou) a která
   nemají vlastní destinaci v Avenier API. Klíčem je slug názvu z podkladu, ne
   ISO kód – některé z těchto prvků žádné ISO číslo nemají. */
const MAP_NAME_CZ={
  'n-mariana-is':'Severní Mariany',
  'guam':'Guam',
  'american-samoa':'Americká Samoa',
  's-geo-and-the-is':'Jižní Georgie a Jižní Sandwichovy ostrovy',
  'br-indian-ocean-ter':'Britské indickooceánské území',
  'indian-ocean-ter':'Australská indickooceánská území',
  'saint-helena':'Svatá Helena',
  'pitcairn-is':'Pitcairnovy ostrovy',
  'falkland-is':'Falklandy',
  'bermuda':'Bermudy',
  'british-virgin-is':'Britské Panenské ostrovy',
  'jersey':'Jersey',
  'guernsey':'Guernsey',
  'isle-of-man':'Ostrov Man',
  'niue':'Niue',
  'palestine':'Palestina',
  'st-pierre-and-miquelon':'Saint-Pierre a Miquelon',
  'wallis-and-futuna-is':'Wallis a Futuna',
  'fr-s-antarctic-lands':'Francouzská jižní a antarktická území',
  'aland':'Ålandy',
  'faeroe-is':'Faerské ostrovy',
  'heard-i-and-mcdonald-is':'Heardův ostrov a McDonaldovy ostrovy',
  'norfolk-island':'Norfolk',
  'antarctica':'Antarktida'
};

const OV={"Bosnia and Herzegovina":"bosnia-and-herzegovina","Burkina Faso":"burkina-faso","Central African Republic":"central-african-republic","Costa Rica":"costa-rica","Czech Republic":"czech-republic","Dominican Republic":"dominican-republic","DR Congo":"democratic-republic-of-the-congo","El Salvador":"el-salvador","Equatorial Guinea":"equatorial-guinea","Eswatini":"eswatini","Guinea-Bissau":"guinea-bissau","New Zealand":"new-zealand","North Korea":"north-korea","North Macedonia":"north-macedonia","Papua New Guinea":"papua-new-guinea","Republic of the Congo":"republic-of-the-congo","Saudi Arabia":"saudi-arabia","Sierra Leone":"sierra-leone","South Africa":"south-africa","South Korea":"south-korea","South Sudan":"south-sudan","Sri Lanka":"sri-lanka","Timor-Leste":"timor-leste","Trinidad and Tobago":"trinidad-and-tobago","United Arab Emirates":"united-arab-emirates","United Kingdom":"united-kingdom","United States":"united-states","Antigua and Barbuda":"antigua-and-barbuda","Cape Verde":"cape-verde","Cote d'Ivoire":"cote-divoire","Sao Tome and Principe":"sao-tome-and-principe","Solomon Islands":"solomon-islands","Vatican City":"vatican-city"};

/* `none` (bez detailu) a `dim` (neodpovídá filtru) byly téměř totožné odstíny.
   Rozestup je záměrně větší, aby legenda pod mapou dávala smysl. */
const MC={ocean:'#0d2040',none:'#2f4569',has:'#78be20',hov:'#5fa018',sel:'#006778',selB:'rgba(170,235,255,0.85)',dim:'#63788d',brd:'rgba(255,255,255,0.24)',brdH:'rgba(255,255,255,0.62)',grat:'rgba(255,255,255,0.055)'};

const API_ALIAS={
  20:['andorra'],
  28:['antigua-a-barbuda','antigua-and-barbuda'],
  31:['azerbajdzan','azerbaijan','azerbajdžán'],
  44:['bahamy','bahamas'],
  48:['bahrajn','bahrain'],
  50:['banglades','bangladesh'],
  52:['barbados'],
  70:['bosna-a-hercegovina','bosnia-and-herzegovina'],
  90:['salomounovy-ostrovy','solomon-islands','salamounovy-ostrovy'],
  96:['brunej','brunei'],
  104:['myanmar','barma','birma','myanmar-barma','barma-myanmar'],
  132:['kapverdy','kapverdske-ostrovy','cabo-verde','cape-verde'],
  140:['stredoafricka-republika','central-african-republic'],
  144:['sri-lanka','srí-lanka'],
  158:['taiwan','tchaj-wan','tchajwan','cinska-republika'],
  174:['komory','comoros'],
  178:['kongo','republika-kongo','republic-of-the-congo','konzska-republika'],
  180:['dr-kongo','demokraticka-republika-kongo','democratic-republic-of-the-congo','dr-congo','konzska-demokraticka-republika','democratic-republic-of-congo','demokraticka-republika-konga','kongo-kinshasa','demokraticka-republika-kongo-zair','zaire','zair'],
  191:['chorvatsko','croatia'],
  203:['ceska-republika','cesko','czech-republic','czechia'],
  214:['dominikanska-republika','dominican-republic'],
  222:['salvador','el-salvador'],
  231:['etiopie','ethiopia'],
  242:['fidzi','fiji'],
  268:['gruzie','georgia'],
  275:['palestina','palestine'],
  300:['recko','greece'],
  304:['gronsko','greenland'],
  336:['vatikan','vatikan-city','vatican','vatican-city'],
  352:['island','iceland'],
  356:['indie','india'],
  360:['indonesie','indonesia'],
  364:['iran'],
  368:['irak','iraq'],
  376:['izrael','israel'],
  383:['kosovo'],
  384:['pobrezi-slonoviny','slonovinove-pobrezi','cote-divoire','ivory-coast','cote-d-ivoire'],
  398:['kazachstan','kazakhstan'],
  400:['jordansko','jordan'],
  404:['kena','kenya'],
  408:['severni-korea','north-korea','korea-severni','kldr','dprk','korejska-lidove-demokraticka-republika','korejska-lidove-demokraticka-republika-kldr'],
  410:['jizni-korea','south-korea','korea-jizni','korejska-republika','republic-of-korea','korejska-republika-jizni-korea'],
  414:['kuvajt','kuwait'],
  417:['kyrgyzstan'],
  422:['libanon','lebanon'],
  442:['lucembursko','luxembourg'],
  450:['madagaskar','madagascar'],
  462:['maledivy','maldives'],
  470:['malta'],
  480:['mauricius','mauritius'],
  484:['mexiko','mexico'],
  492:['monako','monaco'],
  498:['moldavsko','moldova','moldavie','moldavska-republika','republic-of-moldova'],
  499:['cerna-hora','montenegro'],
  504:['maroko','morocco'],
  508:['mozambik','mosambik','mozambique'],
  512:['oman'],
  520:['nauru'],
  524:['nepal'],
  540:['nova-kaledonie','new-caledonia'],
  548:['vanuatu'],
  583:['mikronesie','micronesia','federativni-staty-mikronesie'],
  584:['marshallovy-ostrovy','marshall-islands'],
  585:['palau'],
  586:['pakistan'],
  608:['filipiny','philippines'],
  626:['vychodni-timor','timor-leste'],
  630:['portoriko','puerto-rico'],
  634:['katar','qatar'],
  646:['rwanda'],
  674:['san-marino'],
  678:['svaty-tomas-a-princuv-ostrov','sao-tome-and-principe'],
  682:['saudska-arabie','saudi-arabia'],
  690:['seychely','seychelles'],
  702:['singapur','singapore'],
  703:['slovensko','slovakia'],
  704:['vietnam','viet-nam'],
  706:['somalsko','somalia'],
  710:['jihoafricka-republika','jizni-afrika','south-africa'],
  728:['jizni-sudan','south-sudan'],
  732:['zapadni-sahara','western-sahara'],
  740:['surinam','suriname'],
  748:['svazijsko','eswatini'],
  760:['syrie','syria'],
  764:['thajsko','thailand'],
  776:['tonga'],
  784:['sae','spojene-arabske-emiraty','united-arab-emirates'],
  792:['turecko','turkey'],
  798:['tuvalu'],
  807:['severni-makedonie','north-macedonia','makedonie','republic-of-north-macedonia'],
  818:['egypt'],
  826:['velka-britanie','spojene-kralovstvi','spojene-kralovstvi-velke-britanie-a-severniho-irska','uk','united-kingdom'],
  834:['tanzanie','tanzania','zanzibar'],
  840:['usa','spojene-staty','spojene-staty-americke','united-states-of-america'],
  882:['samoa']
};

const FORCE_ISO_BY_KEY={
  'tuvalu':798,
  'dominika':212,
  'svata-lucie':662,
  'svaty-krystof-a-nevis':659,
  'svaty-vincenc-a-grenadiny':670,
  'barma':104,
  'barma-myanmar':104,
  'birma':104,
  'cinska-republika':158,
  'cote-d-ivoire':384,
  'cote-divoire':384,
  'democratic-republic-of-congo':180,
  'democratic-republic-of-the-congo':180,
  'demokraticka-republika-konga':180,
  'demokraticka-republika-kongo':180,
  'demokraticka-republika-kongo-zair':180,
  'dprk':408,
  'dr-congo':180,
  'dr-kongo':180,
  'greenland':304,
  'gronsko':304,
  'ivory-coast':384,
  'jizni-korea':410,
  'kldr':408,
  'kongo-kinshasa':180,
  'konzska-demokraticka-republika':180,
  'korea-jizni':410,
  'korea-severni':408,
  'korejska-lidove-demokraticka-republika':408,
  'korejska-lidove-demokraticka-republika-kldr':408,
  'korejska-republika':410,
  'korejska-republika-jizni-korea':410,
  'kosovo':383,
  'makedonie':807,
  'moldavie':498,
  'moldavska-republika':498,
  'moldavsko':498,
  'moldova':498,
  'mosambik':508,
  'mozambik':508,
  'mozambique':508,
  'myanmar':104,
  'myanmar-barma':104,
  'new-caledonia':540,
  'north-korea':408,
  'north-macedonia':807,
  'nova-kaledonie':540,
  'pobrezi-slonoviny':384,
  'portoriko':630,
  'puerto-rico':630,
  'republic-of-korea':410,
  'republic-of-moldova':498,
  'republic-of-north-macedonia':807,
  'salamounovy-ostrovy':90,
  'salomounovy-ostrovy':90,
  'severni-korea':408,
  'severni-makedonie':807,
  'slonovinove-pobrezi':384,
  'solomon-islands':90,
  'somalia':706,
  'somalsko':706,
  'south-korea':410,
  'taiwan':158,
  'tanzania':834,
  'tanzanie':834,
  'tchaj-wan':158,
  'tchajwan':158,
  'western-sahara':732,
  'zair':180,
  'zaire':180,
  'zanzibar':834,
  'zapadni-sahara':732
};

const DEST_COORDS={
  630:[-66.59,18.22],  /* Puerto Rico */
  540:[165.62,-21.30], /* New Caledonia */
  158:[120.96,23.70],  /* Taiwan */
  304:[-42.60,71.70],  /* Greenland */
  90:[160.15,-9.65],   /* Solomon Islands */
  732:[-13.20,24.30]   /* Western Sahara */
};

const API_DESTINATION_MAP={
  'americke-panenske-ostrovy':{id:850,mapId:850,coords:[-64.90,18.34]},
  'bali':{id:'api:bali',mapId:360,coords:[115.19,-8.41]},
  'bermudy':{id:60,mapId:60,coords:[-64.75,32.31]},
  'bonaire':{id:'api:bonaire',mapId:535,coords:[-68.27,12.18]},
  'borneo':{id:'api:borneo',mapId:360,coords:[114.00,0.80]},
  'britske-panenske-ostrovy':{id:92,mapId:92,coords:[-64.64,18.42]},
  'cookovy-ostrovy':{id:184,mapId:184,coords:[-159.78,-21.24]},
  'dominika':{id:212,mapId:212,coords:[-61.37,15.41]},
  'francouzska-guyana':{id:'api:francouzska-guyana',mapId:254,coords:[-53.13,3.93]},
  'francouzska-polynesie':{id:258,mapId:258,coords:[-149.41,-17.68]},
  'guadeloupe':{id:'api:guadeloupe',mapId:312,coords:[-61.55,16.25]},
  'hongkong':{id:344,mapId:344,coords:[114.17,22.32]},
  'kajmanske-ostrovy':{id:136,mapId:136,coords:[-81.25,19.31]},
  'kanarske-ostrovy':{id:'api:kanarske-ostrovy',mapId:724,coords:[-15.50,28.30]},
  'korsika':{id:'api:korsika',mapId:250,coords:[9.01,42.04]},
  'mallorca':{id:'api:mallorca',mapId:724,coords:[2.90,39.60]},
  'martinik':{id:'api:martinik',mapId:474,coords:[-61.02,14.64]},
  'reunion':{id:'api:reunion',mapId:638,coords:[55.54,-21.12]},
  'saint-barthelemy':{id:652,mapId:652,coords:[-62.83,17.90]},
  'saint-martin':{id:663,mapId:663,coords:[-63.06,18.08]},
  'sardinie':{id:'api:sardinie',mapId:380,coords:[9.00,40.00]},
  'sicilie':{id:'api:sicilie',mapId:380,coords:[14.00,37.60]},
  'sint-eustatius':{id:'api:sint-eustatius',mapId:535,coords:[-62.98,17.49]},
  'svata-lucie':{id:662,mapId:662,coords:[-60.98,13.91]},
  'svaty-krystof-a-nevis':{id:659,mapId:659,coords:[-62.78,17.35]},
  'svaty-vincenc-a-grenadiny':{id:670,mapId:670,coords:[-61.20,13.25]},
  'tanzanie':{id:834,mapId:834},
  'tasmanie':{id:'api:tasmanie',mapId:36,coords:[146.60,-42.00]},
  'turks-a-caicos':{id:796,mapId:796,coords:[-71.80,21.75]},
  'tuvalu':{id:798,mapId:798,coords:[179.20,-8.52]},
  'zanzibar':{id:'api:zanzibar',mapId:834,coords:[39.20,-6.16]}
};

/* API obsahuje vedle států také samostatně vedená teritoria a cestovatelské
   regiony. Seznam slouží pouze pro transparentní souhrn pokrytí; filtry dál
   pracují s jednotlivými destinacemi přesně tak, jak je vrací API. */
const REGIONAL_DESTINATION_SLUGS=[
  'americke-panenske-ostrovy','anguilla','aruba','bali','bermudy','bonaire','borneo',
  'britske-panenske-ostrovy','cookovy-ostrovy','curacao','francouzska-guyana',
  'francouzska-polynesie','gronsko','guadeloupe','hongkong','kajmanske-ostrovy',
  'kanarske-ostrovy','korsika','macao','mallorca','martinik','montserrat','nova-kaledonie',
  'portoriko','reunion','saint-barthelemy','saint-martin','sardinie','sicilie',
  'sint-eustatius','sint-maarten','tasmanie','turks-a-caicos','zanzibar','zapadni-sahara'
];

const DISEASES={
  'yellow-fever':{
    label:'Žlutá zimnice',
    url:'https://www.ockovacicentrum.cz/cz/zluta-zimnice',
    color:'#78BE20',
    hover:'#5fa018',
    facetColors:{risk:'#78BE20',entry:'#F2B705',both:'#CA005D'},
    facetHover:{risk:'#5fa018',entry:'#d29d00',both:'#a9004e'},
    aliases:['zluta-zimnice','zluta-zimnice-ockovani','yellow-fever','yellow-fever-vaccine']
  },
  'typhoid':{
    label:'Břišní tyfus',
    url:'https://www.ockovacicentrum.cz/cz/brisni-tyfus',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['brisni-tyfus','brsni-tyfus','tyfus','typhoid','typhoid-fever','typhoid-vaccine']
  },
  'dengue':{
    label:'Horečka dengue',
    url:'https://www.ockovacicentrum.cz/cz/horecka-dengue',
    color:'#78BE20',
    hover:'#5fa018',
    facetColors:{endemic:'#CA005D',general:'#78BE20'},
    facetHover:{endemic:'#a9004e',general:'#5fa018'},
    aliases:['horecka-dengue','dengue','dengue-fever','dengue-vaccine']
  },
  'chikungunya':{
    label:'Chikungunya',
    url:'https://www.ockovacicentrum.cz/cz/chikungunya',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['chikungunya']
  },
  'zika':{
    label:'Zika',
    url:'https://www.ockovacicentrum.cz/cz/zika',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['zika','virus-zika']
  },
  'leishmaniasis':{
    label:'Leishmanióza',
    url:'https://www.ockovacicentrum.cz/cz/leishmanioza',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['leishmanioza','leishmaniasis']
  },
  'chagas':{
    label:'Chagasova nemoc',
    url:'https://www.ockovacicentrum.cz/cz/americka-trypanozomiaza-chagasova-nemoc',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['americka-trypanozomiaza','chagasova-nemoc','chagas-disease']
  },
  'rabies':{
    label:'Vzteklina',
    url:'https://www.ockovacicentrum.cz/cz/vzteklina',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['vzteklina','rabies','rabies-vaccine'],
    excludeAliases:['vzteklina-se-nevyskytuje']
  },
  'japanese-encephalitis':{
    label:'Japonská encefalitida',
    url:'https://www.ockovacicentrum.cz/cz/japonska-encefalitida',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['japonska-encefalitida','japanese-encephalitis','japanese-encephalitis-vaccine']
  },
  'cholera':{
    label:'Cholera',
    url:'https://www.ockovacicentrum.cz/cz/cholera',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['cholera','cholera-vaccine','ockovani-proti-cholere']
  },
  'hepatitis-a':{
    label:'Žloutenka A',
    url:'https://www.ockovacicentrum.cz/cz/zloutenka-typu-a',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['zloutenka-typu-a','zloutenka-a','zoutenka-a','hepatitida-a','hepatitis-a','virova-hepatitida-a']
  },
  'hepatitis-b':{
    label:'Žloutenka B',
    url:'https://www.ockovacicentrum.cz/cz/zloutenka-typu-b',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['zloutenka-typu-b','zloutenka-b','hepatitida-b','hepatitis-b','virova-hepatitida-b']
  },
  'polio':{
    label:'Dětská obrna',
    url:'https://www.ockovacicentrum.cz/cz/detska-obrna',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['detska-obrna','poliomyelitida','poliomyelitis','polio']
  },
  'meningococcus':{
    label:'Meningokok',
    url:'https://www.ockovacicentrum.cz/cz/meningokokove-nakazy',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['meningokok','meningokokove-nakazy','meningokokove-infekce','meningococcus','meningococcal']
  },
  'malaria':{
    label:'Malárie',
    url:'https://www.ockovacicentrum.cz/cz/malarie',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['malarie','malaria','antimalarika','antimalarial','komari','komar']
  },
  'tick-borne-encephalitis':{
    label:'Klíšťová encefalitida',
    url:'https://www.ockovacicentrum.cz/cz/klistova-encefalitida',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['klistova-encefalitida','kliste','tick-borne-encephalitis','tbe']
  },
  'measles':{
    label:'Spalničky',
    url:'https://www.ockovacicentrum.cz/cz/spalnicky',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['spalnicky','measles','m-m-r','mmr']
  },
  'flu':{
    label:'Chřipka',
    url:'https://www.ockovacicentrum.cz/cz/ockovani-proti-chripce-sezona-2025-2026',
    color:'#78BE20',
    hover:'#5fa018',
    aliases:['chripka','influenza','flu']
  }
};

/* Volitelný backendový index nemocí.
   Pokud API vrací mapu nemoc -> seznam ID destinací, vyplňte URL.
   Pokud je null, frontend použije metadata v seznamu destinací a fallback přes detail destinace. */
const DISEASE_INDEX_API_URL='assets/data/disease-index.json';

/* Pole v API seznamu destinací, ze kterých se frontend pokusí číst značky nemocí/rizik.
   Každá položka může být string, array nebo objekt s name/key/id/slug/title. */
const DISEASE_INDEX_ROW_FIELDS=[
  'diseases',
  'diseaseKeys',
  'disease_tags',
  'diseaseTags',
  'risks',
  'riskTags',
  'vaccines',
  'vaccinationTags',
  'tags'
];

/* Frontendový fallback pro filtry, které nelze spolehlivě odvodit z názvů položek
   v Avenier API. Žlutá zimnice a malárie vycházejí z CDC Yellow Book 2026
   (veřejný dataset YellowFeverInformationJson), zkontrolováno 2026-08-10.

   U žluté zimnice jsou zahrnuté destinace, kde CDC doporučuje očkování alespoň
   pro část země. Samotná vstupní podmínka při příletu z endemické oblasti nestačí.

   U malárie zvýraznění znamená, že CDC uvádí přenos alespoň v části země;
   neznamená automatické doporučení chemoprofylaxe pro celou zemi.

   Ze snapshotu nejsou zařazeny:
   - Mayotte (není samostatnou destinací v Avenier API),
   - Surinam a Východní Timor (WHO je v roce 2025 certifikovala jako malaria-free),
   - Sýrie (CDC záznam nemá vyplněnou oblast ani doporučení). */
const STATIC_DISEASE_INDEX={
  'yellow-fever':{
    seed:false,
    sourceLabel:'CDC Yellow Book 2026',
    sourceUrl:'https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/yellow-fever-vaccine-and-malaria-prevention-information-by-country.html',
    reviewedLabel:'ověřeno 10. 8. 2026',
    note:'Barvy rozlišují místní riziko žluté zimnice a vstupní podmínku při cestě z rizikové oblasti. Místní riziko znamená doporučení očkování alespoň pro část území, nikoli zprávu o právě probíhající epidemii.',
    destinationSlugs:[
      'angola','argentina','benin','bolivie','brazilie','burkina-faso','burundi','cad',
      'demokraticka-republika-kongo-zair','ekvador','francouzska-guyana','gabon','gambie',
      'ghana','guinea','guinea-bissau','guyana','jizni-sudan','kamerun','kena','kolumbie',
      'kongo','liberie','mali','mauritanie','niger','nigerie','panama','paraguay','peru',
      'pobrezi-slonoviny','rovnikova-guinea','senegal','sierra-leone','stredoafricka-republika',
      'sudan','surinam','togo','trinidad-a-tobago','uganda','venezuela'
    ]
  },
  'malaria':{
    sourceLabel:'CDC Yellow Book 2026',
    sourceUrl:'https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/yellow-fever-vaccine-and-malaria-prevention-information-by-country.html',
    reviewedLabel:'ověřeno 10. 8. 2026',
    note:'Mapa zvýrazňuje země, kde se malárie může vyskytovat alespoň v části území. Riziko se často liší podle oblasti, roční doby, trasy i způsobu cestování. Vhodnou ochranu je proto potřeba posoudit podle konkrétní cesty.',
    destinationSlugs:[
      'afghanistan','angola','banglades','benin','bhutan','bolivie','botswana','brazilie',
      'brunej','burkina-faso','burundi','cad','demokraticka-republika-kongo-zair',
      'dominikanska-republika','dzibutsko','ekvador','eritrea','etiopie','filipiny',
      'francouzska-guyana','gabon','gambie','ghana','guatemala','guinea','guinea-bissau',
      'guyana','haiti','honduras','indie','indonesie','iran','jemen','jihoafricka-republika',
      'jizni-sudan','kambodza','kamerun','kena','kolumbie','komory','kongo',
      'korejska-lidove-demokraticka-republika-kldr','korejska-republika-jizni-korea',
      'kostarika','laos','liberie','madagaskar','malajsie','malawi','mali','mauritanie',
      'mexiko','mosambik','myanmar-barma','namibie','nepal','niger','nigerie','nikaragua',
      'oman','pakistan','panama','papua-nova-guinea','peru','pobrezi-slonoviny','recko',
      'rovnikova-guinea','rwanda','salamounovy-ostrovy','saudska-arabie','senegal',
      'sierra-leone','somalsko','stredoafricka-republika','sudan','svaty-tomas-a-princuv-ostrov',
      'svazijsko','tanzanie','thajsko','togo','uganda','vanuatu','venezuela','vietnam',
      'zambie','zimbabwe'
    ]
  },
  'chikungunya':{
    sourceLabel:'CDC – Areas at Risk for Chikungunya',
    sourceUrl:'https://www.cdc.gov/chikungunya/data-maps/',
    reviewedLabel:'ověřeno 10. 8. 2026',
    note:'Zvýrazněné jsou destinace, pro které CDC uvádí aktuální ohnisko nebo zvýšené riziko pro cestovatele. Seznam se může měnit rychleji než ostatní filtry; před cestou vždy otevřete aktuální zdroj.',
    destinationSlugs:[
      'bolivie','brazilie','francouzska-guyana','indie','indonesie','kolumbie','kostarika',
      'mauricius','mexiko','nigerie','nikaragua','pakistan','peru','filipiny','seychely',
      'surinam','thajsko'
    ]
  },
  'zika':{
    sourceLabel:'CDC – Countries & Territories at Risk for Zika',
    sourceUrl:'https://www.cdc.gov/zika/geo/',
    reviewedLabel:'klasifikace CDC k 15. 5. 2026, ověřeno 10. 8. 2026',
    note:'Mapa zobrazuje destinace s aktuálním nebo dříve potvrzeným místním přenosem viru Zika. Neříká, že právě probíhá epidemie; CDC tuto širší kategorii používá kvůli rozdílům v kvalitě sledování mezi zeměmi.',
    destinationSlugs:[
      'americke-panenske-ostrovy','angola','anguilla','antigua-a-barbuda','argentina','aruba',
      'bahamy','banglades','barbados','belize','bolivie','bonaire','brazilie',
      'britske-panenske-ostrovy','burkina-faso','burundi','cookovy-ostrovy','curacao',
      'dominika','dominikanska-republika','ekvador','etiopie','fidzi','filipiny',
      'francouzska-guyana','francouzska-polynesie','gabon','grenada','guadeloupe','guatemala',
      'guinea','guinea-bissau','guyana','haiti','honduras','indie','indonesie','jamajka','jemen',
      'kajmanske-ostrovy','kambodza','kamerun','kapverdy','kena','kiribati','kolumbie',
      'kostarika','kuba','laos','madagaskar','malajsie','maledivy','mali','marshallovy-ostrovy',
      'martinik','mexiko','mikronesie','montserrat','myanmar-barma','nigerie','nikaragua',
      'nova-kaledonie','pakistan','palau','panama','papua-nova-guinea','paraguay','peru',
      'pobrezi-slonoviny','portoriko','saint-barthelemy','saint-martin','salvador','samoa',
      'senegal','seychely','singapur','sint-maarten','sri-lanka','stredoafricka-republika',
      'surinam','svata-lucie','svaty-krystof-a-nevis','svaty-vincenc-a-grenadiny',
      'salamounovy-ostrovy','thajsko','tonga','trinidad-a-tobago','turks-a-caicos','uganda',
      'vanuatu','venezuela','vietnam'
    ]
  },
  'leishmaniasis':{
    sourceLabel:'WHO Global Health Observatory – Leishmaniasis',
    sourceUrl:'https://www.who.int/data/gho/data/themes/topics/topic-details/GHO/leishmaniasis',
    reviewedLabel:'data za rok 2024, ověřeno 10. 8. 2026',
    note:'Pro přehlednost jsou zvýrazněny země s nejvyšší hlášenou zátěží v datech WHO za rok 2024: více než 5 000 případů kožní formy nebo země tvořící přibližně 85 % hlášených případů viscerální formy. Nemoc se může vyskytovat i jinde.',
    destinationSlugs:[
      'afghanistan','alzirsko','brazilie','etiopie','indie','iran','kena','kolumbie','peru',
      'somalsko','sudan','syrie','jizni-sudan'
    ]
  },
  'chagas':{
    sourceLabel:'WHO – Chagas disease',
    sourceUrl:'https://www.who.int/news-room/fact-sheets/detail/chagas-disease-%28american-trypanosomiasis%29',
    reviewedLabel:'ověřeno 10. 8. 2026',
    note:'Zvýrazněno je 21 pevninských zemí Latinské Ameriky, které WHO uvádí jako endemické. Riziko není v rámci zemí rovnoměrné a souvisí zejména s konkrétní oblastí a podmínkami pobytu.',
    destinationSlugs:[
      'argentina','belize','bolivie','brazilie','chile','ekvador','francouzska-guyana',
      'guatemala','guyana','honduras','kolumbie','kostarika','mexiko','nikaragua','panama',
      'paraguay','peru','salvador','surinam','uruguay','venezuela'
    ]
  }
};
