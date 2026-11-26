import numpy as np,json
from PIL import Image, ImageDraw, ImageFilter
im=Image.open('tpose.jpg').convert('RGB');A=np.asarray(im).astype(int);H,W=A.shape[:2]
bg=np.array([245,245,245])
d=np.abs(A-bg).max(2)
fg=d>22
# limpa pontinhos e fecha buraquinhos
# fundo = só o claro que encosta na borda (o branco do capacete/tênis fica)
from scipy import ndimage
bgl=d<=22
lab,n=ndimage.label(bgl)
edge=np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]]);edge=edge[edge>0]
bgm=np.isin(lab,edge)
fg=~bgm
fg=ndimage.binary_opening(fg,iterations=1)
yy,xx=np.mgrid[:H,:W]
def circ(cx,cy,r):return (xx-cx)**2+(yy-cy)**2<=r*r
def ell(cx,cy,rx,ry):return ((xx-cx)/rx)**2+((yy-cy)/ry)**2<=1
def rect(x0,y0,x1,y1):return (xx>=x0)&(xx<x1)&(yy>=y0)&(yy<y1)
J=dict(neck=(283,298),shL=(208,337),elL=(136,339),wrL=(80,345),hipL=(240,528),knL=(230,650),hipR=(336,528),knR=(346,650),root=(288,520))
head=ell(283,207,82,96)&(yy<306)
armzoneL=rect(0,296,204,382)
torso=(rect(172,232,398,514)&~rect(0,296,204,382)&~rect(366,296,600,382))|(circ(*J['shL'],36)&(xx>=184))|(circ(366,337,36)&(xx<=388))
upL=(rect(124,298,204,380)|circ(204,339,40))&(xx<216)
foL=(rect(74,296,140,382)|circ(*J['elL'],34))&rect(0,290,210,390)
haL=(rect(0,310,84,382)|circ(*J['wrL'],21))&rect(0,300,100,390)
hips=rect(196,490,384,566)
thL=(rect(172,505,289,660)|circ(*J['hipL'],46))&rect(160,480,289,670)
shL=(rect(110,640,292,830)|circ(*J['knL'],40))&rect(100,600,292,830)
thR=(rect(288,505,404,660)|circ(*J['hipR'],46))&rect(288,480,410,670)
shR=(rect(286,640,460,830)|circ(*J['knR'],40))&rect(286,600,470,830)
parts={'head':head,'torso':torso,'upL':upL,'foL':foL,'haL':haL,'hips':hips,'thL':thL,'shL':shL,'thR':thR,'shR':shR}
RGBA=np.dstack([A,np.full((H,W),255)]).astype(np.uint8)
out={}
SC=0.5
for n,pm in parts.items():
    m=pm&fg
    img=RGBA.copy();img[...,3]=np.where(m,255,0)
    if n in('torso','upL'):
        # contorno preto na curva do ombro/ponta do braço, como no traço original
        if n=='torso':
            rr=np.sqrt((xx-J['shL'][0])**2+(yy-J['shL'][1])**2);ring=(rr>32.5)&(rr<=36.5)&(xx<204)&(yy<380)&(yy>298)
            rr2=np.sqrt((xx-366)**2+(yy-337)**2);ring|=(rr2>32.5)&(rr2<=36.5)&(xx>370)&(yy<380)&(yy>298)
        else:
            rr=np.sqrt((xx-204)**2+(yy-339)**2);ring=(rr>37)&(rr<=40.5)&(xx>204)&(xx<216)
        img[ring&m]=[20,22,27,255]
    if n=='torso':
        # completa a lateral da bag escondida atrás do braço (repete a faixa logo abaixo)
        for x0_,x1_ in((172,206),(364,398)):
            src=img[388,x0_:x1_].copy()
            for yv in range(292,388):
                row=img[yv,x0_:x1_];holes=row[:,3]==0
                row[holes]=src[holes]
        # buraco atrás do capacete: interior escuro do capuz
        hole=ell(283,215,74,88)&(yy>232)&(yy<306)
        img[hole]=[22,26,44,255]
    ys,xs=np.nonzero(img[...,3]>0)
    x0,y0,x1,y1=xs.min(),ys.min(),xs.max()+1,ys.max()+1
    sub=Image.fromarray(img[y0:y1,x0:x1],'RGBA')
    # borda suave
    a=sub.split()[3].filter(ImageFilter.GaussianBlur(0.6));sub.putalpha(a)
    sub=sub.resize((max(1,round((x1-x0)*SC)),max(1,round((y1-y0)*SC))),Image.LANCZOS)
    sub.save(f'part_{n}.png');out[n]=[int(x0),int(y0),int(x1),int(y1)]
json.dump({'boxes':out,'joints':J,'scale':SC},open('parts.json','w'),indent=1)
print(out)
