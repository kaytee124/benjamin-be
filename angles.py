from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import cm
import matplotlib.pyplot as plt
import numpy as np, os, math

base=os.path.join(os.path.dirname(os.path.abspath(__file__)), "alternate_angles_out")
imgdir=os.path.join(base,"alternate_angles_varied")
os.makedirs(imgdir,exist_ok=True)

# Different configurations: positions are specified as wedge locations
# at upper/lower intersection: TL, TR, BL, BR.
# Alternating pairs are chosen across the transversal, including interior/exterior.
questions=[
    ("BL","TR","42°","x"),
    ("TR","BL","x","68°"),
    ("BR","TL","115°","x"),
    ("TL","BR","x","37°"),
    ("BL","TR","2x + 10°","70°"),
    ("BR","TL","3x - 5°","100°"),
    ("TR","BL","x + 15°","95°"),
    ("TL","BR","2x + 20°","140°"),
    ("BL","TR","3x","75°"),
    ("BR","TL","x - 12°","84°"),
]

# wedge centers relative to intersection: TL, TR, BL, BR
def wedge_point(cx, cy, wedge, r=.65):
    coords={"TR":(.45,.45),"TL":(-.45,.45),"BL":(-.45,-.45),"BR":(.45,-.45)}
    dx,dy=coords[wedge]
    return cx+dx, cy+dy

def make_diagram(i, pos_x, pos_given, xtext, gtext, path):
    fig, ax=plt.subplots(figsize=(7.0,3.6))
    # vary transversal slope and intercept slightly
    slopes=[.62,.78,.48,.9,.68,.55,.82,.43,.72,.58]
    m=slopes[i-1]
    ytop=1.35; ybot=-1.35
    xupper=ytop/m
    xlower=ybot/m
    xx=np.linspace(-5,5,100)
    ax.plot(xx, [ytop]*len(xx), lw=3)
    ax.plot(xx, [ybot]*len(xx), lw=3)
    ax.plot(xx, m*xx, lw=3)
    
    # parallel arrows
    ax.annotate("",xy=(3.7,ytop),xytext=(3.0,ytop),arrowprops=dict(arrowstyle="->",lw=1.3))
    ax.annotate("",xy=(3.7,ybot),xytext=(3.0,ybot),arrowprops=dict(arrowstyle="->",lw=1.3))
    
    # angle labels
    def label_angle(xc,yc,wedge,text):
        px,py=wedge_point(xc,yc,wedge)
        ax.text(px,py,text,fontsize=15,fontweight="bold",
                ha="center",va="center")
        # small curved arc approximating wedge
        if wedge=="TR": a1,a2=0,42
        elif wedge=="TL": a1,a2=138,180
        elif wedge=="BL": a1,a2=180,222
        else: a1,a2=-42,0
        th=np.linspace(np.deg2rad(a1),np.deg2rad(a2),30)
        ax.plot(xc+.48*np.cos(th),yc+.48*np.sin(th),lw=2)
    
    label_angle(xupper,ytop,pos_x,xtext)
    label_angle(xlower,ybot,pos_given,gtext)
    
    ax.text(4.25,ytop+.22,"l₁",fontsize=13,fontweight="bold")
    ax.text(4.25,ybot+.22,"l₂",fontsize=13,fontweight="bold")
    ax.set_xlim(-5.2,5.2); ax.set_ylim(-2.1,2.1)
    ax.set_aspect("equal"); ax.axis("off")
    ax.set_title(f"Question {i}",fontsize=15,fontweight="bold")
    fig.tight_layout()
    fig.savefig(path,dpi=180,bbox_inches="tight")
    plt.close(fig)

paths=[]
for i,(px,pg,xt,gt) in enumerate(questions,1):
    p=os.path.join(imgdir,f"q{i}.png")
    make_diagram(i,px,pg,xt,gt,p)
    paths.append(p)

# DOCX
doc=Document()
s=doc.sections[0]
s.top_margin=Inches(.5); s.bottom_margin=Inches(.5)
s.left_margin=Inches(.65); s.right_margin=Inches(.65)
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
r=p.add_run("ALTERNATE ANGLES\n"); r.bold=True; r.font.size=Pt(23)
r=p.add_run("10 Different Practice Questions"); r.bold=True; r.font.size=Pt(15)
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
p.add_run("The two horizontal lines are parallel. Find x in each diagram. Show your working and give a reason.")
doc.add_paragraph("Name: ____________________________________    Date: ____________________")

for i,path in enumerate(paths,1):
    q=doc.add_paragraph()
    rr=q.add_run(f"{i}. Find x. Give a reason for your answer.")
    rr.bold=True
    doc.add_picture(path,width=Inches(6.35))
    doc.paragraphs[-1].alignment=WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph("Answer: ____________________    Reason: __________________________________________")
    if i in [5,6,7,8,9,10]:
        doc.add_paragraph("Working: _______________________________________________________________________")
        
doc.add_page_break()
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
r=p.add_run("ALTERNATE ANGLES — QUICK REMINDER"); r.bold=True; r.font.size=Pt(18)
for t in [
    "Alternate interior angles are inside the parallel lines and on opposite sides of the transversal.",
    "Alternate exterior angles are outside the parallel lines and on opposite sides of the transversal.",
    "For parallel lines, alternate angles are equal."
]:
    doc.add_paragraph(t,style="List Bullet")

docx=os.path.join(base,"Alternate_Angles_10_Different_Questions.docx")
doc.save(docx)

# PDF
ss=getSampleStyleSheet()
title=ParagraphStyle("title2",parent=ss["Title"],alignment=TA_CENTER,fontSize=20,leading=23,spaceAfter=4)
sub=ParagraphStyle("sub2",parent=ss["Normal"],alignment=TA_CENTER,fontSize=10.5,leading=14,spaceAfter=6)
qstyle=ParagraphStyle("q2",parent=ss["Normal"],fontName="Helvetica-Bold",fontSize=10.5,spaceBefore=2,spaceAfter=2)
pdf=os.path.join(base,"Alternate_Angles_10_Different_Questions.pdf")
story=[
    Paragraph("ALTERNATE ANGLES",title),
    Paragraph("10 Different Practice Questions",title),
    Paragraph("<b>The two horizontal lines are parallel.</b> Find x in each diagram. Show your working and give a reason.",sub),
    Paragraph("Name: ____________________________________ &nbsp;&nbsp; Date: ____________________",ss["Normal"]),
    Spacer(1,5)
]
for i,path in enumerate(paths,1):
    story += [
        Paragraph(f"{i}. Find x. Give a reason for your answer.",qstyle),
        Image(path,width=16.1*cm,height=7.55*cm),
        Paragraph("Answer: ____________________ &nbsp;&nbsp; Reason: __________________________________________",ss["Normal"]),
        Spacer(1,4)
    ]
story += [PageBreak(),Paragraph("ALTERNATE ANGLES — QUICK REMINDER",title)]
for t in [
    "Alternate interior angles are inside the parallel lines and on opposite sides of the transversal.",
    "Alternate exterior angles are outside the parallel lines and on opposite sides of the transversal.",
    "For parallel lines, alternate angles are equal."
]:
    story += [Paragraph("• "+t,ss["Normal"]),Spacer(1,4)]
SimpleDocTemplate(pdf,pagesize=A4,rightMargin=1.2*cm,leftMargin=1.2*cm,
                  topMargin=1.0*cm,bottomMargin=1.0*cm).build(story)

print(docx)
print(pdf)
