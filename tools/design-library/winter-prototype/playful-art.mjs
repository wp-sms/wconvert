// Original companion artwork for concepts 36–40. Raster assets are replaceable
// as a whole; illustration parts are not exposed as editor controls.
const wrap=(bg,body)=>`<svg viewBox="0 0 600 500" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="500" fill="${bg}"/>${body}</svg>`;
const dot=(x,y,r,c)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const star=(x,y,r,c)=>`<path d="M${x} ${y-r}Q${x+3} ${y-3} ${x+r} ${y}Q${x+3} ${y+3} ${x} ${y+r}Q${x-3} ${y+3} ${x-r} ${y}Q${x-3} ${y-3} ${x} ${y-r}" fill="${c}"/>`;
const present=(x,y,w,h,c,r,angle=0)=>`<g transform="translate(${x} ${y}) rotate(${angle})"><rect width="${w}" height="${h}" rx="8" fill="${c}"/><path d="M0 ${h*.32}H${w}M${w*.5} 0V${h}" stroke="${r}" stroke-width="${w*.13}"/><path d="M${w*.5} 0C${w*.1} -42 ${-w*.15} 2 ${w*.5} 0C${w*1.12} 2 ${w*.9} -42 ${w*.5} 0" fill="none" stroke="${r}" stroke-width="8" stroke-linecap="round"/></g>`;
const snow=[ [45,80,4],[540,130,7],[75,320,5],[495,350,4],[450,55,5],[140,155,5],[355,55,4] ].map(([x,y,r])=>dot(x,y,r,'#fff9e7')).join('');
export const playfulArt={
 yeti:wrap('#a9d4d6',`${snow}<ellipse cx="300" cy="450" rx="210" ry="24" fill="#7db6bd"/>
 <path d="M174 288Q90 261 104 170L138 126 160 146 154 198Q185 237 210 229M377 270Q465 271 474 209L503 208 514 245Q496 328 400 332" fill="#fff8df" stroke="#fff8df" stroke-width="30" stroke-linejoin="round"/>
 <path d="M164 365Q151 300 182 231L202 153 227 146 224 122 253 126 274 91 301 115 330 99 345 128 378 127 373 157Q414 222 420 325L404 411 348 420 310 382 269 418 203 419Z" fill="#fff8df"/>
 <ellipse cx="298" cy="199" rx="73" ry="59" fill="#c0e0dd"/>${dot(271,187,8,'#244d59')}${dot(325,187,8,'#244d59')}
 <path d="M276 216Q297 235 320 211" fill="none" stroke="#244d59" stroke-width="6" stroke-linecap="round"/><path d="M283 223L291 235 298 226" fill="#fff8df"/>
 <path d="M199 253Q290 281 394 247L391 278Q288 307 198 283Z" fill="#d6464c"/><path d="M337 278L359 352 389 340 365 274Z" fill="#d6464c"/><path d="M357 298L378 290M363 319L384 312" stroke="#f4b4ac" stroke-width="8"/>
 ${present(218,320,136,103,'#ecb947','#b74557',-7)}<ellipse cx="210" cy="362" rx="26" ry="35" fill="#fff8df"/><ellipse cx="365" cy="345" rx="25" ry="34" fill="#fff8df"/>
 <path d="M201 425L206 443H255L262 423M341 423L348 443H396L399 424" fill="#fff8df"/>${star(484,105,25,'#e8aa3e')}`),
 ginger:wrap('#f7cabc',`<ellipse cx="300" cy="456" rx="245" ry="21" fill="#e5a898"/>
 <path d="M144 229L302 77 462 229V424H144Z" fill="#ae623d"/><path d="M122 237L302 61 485 237" fill="none" stroke="#fff4da" stroke-width="28" stroke-linecap="round"/>
 <path d="M150 244Q174 285 199 245Q225 285 249 245Q275 285 301 245Q327 285 353 245Q379 285 404 245Q430 285 455 245" fill="none" stroke="#fff4da" stroke-width="12"/>
 <path d="M257 424V333Q257 277 304 277Q351 277 351 333V424" fill="#653e39"/><path d="M268 424V337Q268 290 304 290Q340 290 340 337" fill="none" stroke="#f4ddaa" stroke-width="7"/>
 <rect x="174" y="294" width="57" height="64" rx="8" fill="#f0bd5c"/><rect x="375" y="294" width="57" height="64" rx="8" fill="#f0bd5c"/><path d="M202 294V358M174 326H231M403 294V358M375 326H432" stroke="#fff4da" stroke-width="7"/>
 ${dot(302,192,26,'#4f7864')}${dot(302,192,16,'#ae623d')}${dot(291,174,6,'#d84749')}${dot(310,211,6,'#d84749')}
 <g transform="translate(83 337) rotate(-13)"><path d="M0 45L-20 75M28 45L47 75M-2 19L-29 33M29 19L54 31" stroke="#b86d43" stroke-width="23" stroke-linecap="round"/><rect y="12" width="29" height="49" rx="14" fill="#b86d43"/>${dot(14,-6,24,'#b86d43')}${dot(6,-11,3,'#fff2da')}${dot(22,-11,3,'#fff2da')}<path d="M5 1Q14 9 23 1" fill="none" stroke="#fff2da" stroke-width="3"/>${dot(14,27,4,'#dc414b')}${dot(14,43,4,'#dc414b')}</g>
 <path d="M505 419V300Q505 269 532 269Q559 269 559 294" fill="none" stroke="#fff4da" stroke-width="16" stroke-linecap="round"/><path d="M505 401V389M505 366V354M505 331V319M516 273L527 281M547 277L541 290" stroke="#d94e51" stroke-width="13"/>
 ${star(88,170,24,'#dc6861')}${star(503,100,21,'#dc6861')}<path d="M170 403H228M378 403H437" stroke="#fff4da" stroke-width="10" stroke-linecap="round"/>`),
 penguin:wrap('#b8c5ed',`${snow}<ellipse cx="300" cy="442" rx="230" ry="22" fill="#98a9d9"/>
 <path d="M107 401L431 401Q474 401 491 367" fill="none" stroke="#f8e5b9" stroke-width="15" stroke-linecap="round"/><path d="M160 366V401M390 366V401" stroke="#f8e5b9" stroke-width="12"/><rect x="123" y="349" width="313" height="22" rx="11" fill="#b94951"/>
 <path d="M199 303Q174 250 193 174Q206 126 260 129Q320 130 339 189L358 300Q349 349 284 352Q216 348 199 303" fill="#293b63"/><ellipse cx="270" cy="258" rx="63" ry="81" fill="#fff0d5"/>
 <path d="M214 196Q225 155 253 174L272 192 289 172Q322 162 329 208L318 236H217Z" fill="#fff0d5"/>${dot(243,200,5,'#293b63')}${dot(298,200,5,'#293b63')}<path d="M258 211L283 211 271 229Z" fill="#e5a440"/>
 <path d="M194 184L319 170 299 102 238 74Z" fill="#d14d5a"/><path d="M194 185L325 170" stroke="#ffefd7" stroke-width="19" stroke-linecap="round"/>${dot(240,75,17,'#fff0d5')}
 <path d="M210 241Q270 259 325 237" stroke="#edb64a" stroke-width="17" fill="none"/><path d="M309 246L340 298 362 281 328 240Z" fill="#edb64a"/>
 <ellipse cx="233" cy="346" rx="31" ry="12" fill="#e5a440"/><ellipse cx="305" cy="346" rx="31" ry="12" fill="#e5a440"/>
 ${present(359,256,95,89,'#d75761','#fff0d5',7)}${present(363,206,74,58,'#e4b44d','#5c7895',-9)}
 <path d="M207 250Q168 283 176 320M316 260L362 291" stroke="#293b63" stroke-width="22" stroke-linecap="round"/>${star(447,102,26,'#fff0d5')}`),
 giftcat:wrap('#33304f',`<ellipse cx="300" cy="453" rx="200" ry="20" fill="#25243c"/>
 <path d="M389 357Q523 335 492 247Q481 217 459 238" fill="none" stroke="#e8ad72" stroke-width="35" stroke-linecap="round"/>
 <path d="M182 289Q166 222 188 179L179 101 245 143Q301 121 350 148L408 105 405 192Q441 261 398 311Z" fill="#e8ad72"/>
 <path d="M192 121L235 153 198 174M394 125L363 155 395 176" fill="#ce7b6b"/><path d="M267 139L280 180M300 136L301 181M333 142L322 183" stroke="#ba7249" stroke-width="10" stroke-linecap="round"/>
 <path d="M225 217Q242 199 259 218M335 218Q352 200 369 219" fill="none" stroke="#33304f" stroke-width="7" stroke-linecap="round"/><path d="M282 239L303 239 293 251Z" fill="#9b4e4f"/><path d="M293 251Q282 273 269 259M293 251Q307 273 319 259" fill="none" stroke="#33304f" stroke-width="4"/>
 <path d="M219 245L163 233M221 259L162 267M367 246L425 234M367 260L427 270" stroke="#fff0d6" stroke-width="3"/>
 ${present(170,316,251,119,'#bc4d62','#f2c463',0)}<path d="M164 316L408 286 420 312 174 343Z" fill="#d66574"/>
 <ellipse cx="225" cy="323" rx="29" ry="25" fill="#e8ad72"/><ellipse cx="370" cy="306" rx="29" ry="24" fill="#e8ad72"/>
 ${star(100,125,23,'#f2c463')}${star(493,158,17,'#f2c463')}${dot(105,355,5,'#df91a4')}${dot(465,70,6,'#df91a4')}`),
 party:wrap('#edb7c7',`<ellipse cx="300" cy="451" rx="225" ry="22" fill="#d991ad"/>
 <path d="M147 418V227Q134 152 177 141Q196 136 201 164L208 206 230 208 225 119Q221 77 250 78Q279 79 276 125L278 208Q335 218 348 282L358 418Z" fill="#fff2d6"/>
 <path d="M157 186L233 170 199 100Z" fill="#d95753"/><path d="M184 146L210 141M173 170L223 159" stroke="#f2bc59" stroke-width="9"/>${dot(199,100,11,'#f2bc59')}
 ${dot(258,258,6,'#44385e')}${dot(302,254,6,'#44385e')}<path d="M275 275L287 275 280 283Z" fill="#ce7b87"/><path d="M276 293Q294 309 306 288" fill="none" stroke="#44385e" stroke-width="4"/>
 <path d="M174 331L119 308M324 332L363 287" stroke="#fff2d6" stroke-width="26" stroke-linecap="round"/>
 <path d="M356 421Q337 345 359 302Q388 266 430 287Q471 308 469 421Z" fill="#70628f"/>
 <path d="M361 313L354 257 391 289M429 290L469 261 466 321" fill="#70628f"/><path d="M378 301L407 217 440 299Z" fill="#d45a55"/><path d="M386 276L430 276M393 253L422 253" stroke="#f4c467" stroke-width="9"/>${dot(407,217,10,'#f4c467')}
 <path d="M378 337Q389 325 398 338M428 337Q438 326 448 338" stroke="#fff2d6" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M407 349L420 349 414 360Z" fill="#edb7c7"/>
 <path d="M111 304L65 284 75 318Z" fill="#d95753"/><path d="M69 301Q42 280 53 257" stroke="#44385e" stroke-width="5" fill="none"/>
 <path d="M93 117L105 143M465 96L447 117M495 347L514 361M328 68L340 91M365 149L350 161" stroke="#d95753" stroke-width="9" stroke-linecap="round"/>
 ${star(480,205,25,'#fff2d6')}${star(95,212,18,'#f4c467')}${star(330,125,19,'#44385e')}`),
};

// A wide acknowledgement source keeps the same character without cropping.
playfulArt.giftcatBanner = playfulArt.giftcat.replace('viewBox="0 0 600 500"', 'viewBox="0 0 1000 500"').replace('<rect width="600"', '<rect width="1000"').replace('/><ellipse', '/><g transform="translate(200 0)"><ellipse').replace('</svg>', '</g></svg>');
